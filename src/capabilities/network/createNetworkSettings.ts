import { NodeReadError } from './NodeReadError';
import {
  DEFAULT_NETWORK_PREFERENCES,
  NETWORKS,
  normalizeHorizonEndpoint,
  isNodeAvailable,
  validateNetworkPreferences,
  type NetworkId,
  type NetworkPreferences,
  type NetworkPreferenceStore,
} from './networkPreferences';

export type NodeTestResult = Readonly<{ status: 'reachable' | 'wrong-network' | 'unavailable'; checkedAt: number }>;
export type NetworkSettingsSnapshot = Readonly<{
  preferences: NetworkPreferences;
  busy: boolean;
  interruption: number;
  tests: Readonly<Record<string, NodeTestResult>>;
}>;
export function createNetworkSettings(
  deps: Readonly<{
    store: NetworkPreferenceStore;
    initial?: NetworkPreferences;
    authorize: (passphrase: string, signal: AbortSignal) => Promise<void>;
    probe: (endpoint: string, signal: AbortSignal) => Promise<string>;
    assertCanSwitch: (target: NetworkId) => void;
    restart: () => void;
    isForeground: () => boolean;
  }>,
) {
  let snapshot: NetworkSettingsSnapshot = Object.freeze({
    preferences: validateNetworkPreferences(deps.initial ?? deps.store.load() ?? DEFAULT_NETWORK_PREFERENCES),
    busy: false,
    interruption: 0,
    tests: Object.freeze({}),
  });
  const listeners = new Set<() => void>();
  let active: AbortController | undefined;
  let closed = false;
  const retryAfter = new Map<string, number>();
  function publish(next: NetworkSettingsSnapshot) {
    snapshot = Object.freeze(next);
    listeners.forEach(fn => fn());
  }
  function assertCurrent(signal: AbortSignal) {
    if (closed || signal.aborted || !deps.isForeground()) throw new Error('operation-cancelled');
  }
  function requireDeveloper() {
    if (!snapshot.preferences.developerMode) throw new Error('developer-mode-required');
  }
  function requireNode(id: NetworkId, endpoint: string) {
    if (!NETWORKS[id] || ![NETWORKS[id].horizonUrl, ...snapshot.preferences.customNodes[id]].includes(endpoint))
      throw new Error('node-not-found');
    if (!isNodeAvailable(snapshot.preferences, id, endpoint)) throw new Error('developer-mode-required');
  }
  async function run<T>(action: (signal: AbortSignal) => Promise<T>): Promise<T> {
    if (snapshot.busy) throw new Error('network-settings-busy');
    const owner = new AbortController();
    active = owner;
    assertCurrent(owner.signal);
    publish({ ...snapshot, busy: true });
    try {
      return await action(owner.signal);
    } finally {
      if (active === owner) {
        active = undefined;
        if (!closed) publish({ ...snapshot, busy: false });
      }
    }
  }
  async function test(id: NetworkId, endpoint: string, signal: AbortSignal): Promise<NodeTestResult> {
    const request = new AbortController();
    let rejectCancellation!: (error: Error) => void;
    const cancelled = new Promise<never>((_, reject) => {
      rejectCancellation = reject;
    });
    const abort = () => {
      rejectCancellation(new Error('operation-cancelled'));
      request.abort();
    };
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    const timer = setTimeout(() => {
      rejectCancellation(new Error('node-timeout'));
      request.abort();
    }, 10000);
    let result: NodeTestResult;
    try {
      assertCurrent(signal);
      if ((retryAfter.get(endpoint) ?? 0) > Date.now()) throw new Error('node-cooldown');
      const passphrase = await Promise.race([deps.probe(endpoint, request.signal), cancelled]);
      result = {
        status: passphrase === NETWORKS[id].networkPassphrase ? 'reachable' : 'wrong-network',
        checkedAt: Date.now(),
      };
    } catch (error) {
      if (error instanceof NodeReadError && error.retryAfterMs !== undefined)
        retryAfter.set(endpoint, Math.max(retryAfter.get(endpoint) ?? 0, Date.now() + error.retryAfterMs));
      result = { status: 'unavailable', checkedAt: Date.now() };
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
    }
    assertCurrent(signal);
    publish({ ...snapshot, tests: Object.freeze({ ...snapshot.tests, [JSON.stringify([id, endpoint])]: result }) });
    return result;
  }
  async function verify(id: NetworkId, endpoint: string, signal: AbortSignal) {
    const result = await test(id, endpoint, signal);
    if (result.status !== 'reachable')
      throw new Error(result.status === 'wrong-network' ? 'wrong-network' : 'node-unavailable');
  }
  function save(next: NetworkPreferences, signal: AbortSignal, restart: boolean) {
    assertCurrent(signal);
    const validated = validateNetworkPreferences(next);
    if (restart) deps.assertCanSwitch(validated.networkId);
    deps.store.save(validated);
    if (restart) {
      snapshot = Object.freeze({ ...snapshot, preferences: validated });
      deps.restart();
      if (!closed) publish(snapshot);
    } else publish({ ...snapshot, preferences: validated });
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    enableDeveloperMode(passphrase: string) {
      return run(async signal => {
        await deps.authorize(passphrase, signal);
        save({ ...snapshot.preferences, developerMode: true }, signal, false);
      });
    },
    disableDeveloperMode() {
      return run(async signal => {
        await verify('stellar-mainnet', NETWORKS['stellar-mainnet'].horizonUrl, signal);
        save(
          {
            ...snapshot.preferences,
            developerMode: false,
            selectionConfirmed: true,
            networkId: 'stellar-mainnet',
            endpoints: { ...snapshot.preferences.endpoints, 'stellar-mainnet': NETWORKS['stellar-mainnet'].horizonUrl },
          },
          signal,
          true,
        );
      });
    },
    addNode(id: NetworkId, input: string) {
      return run(async signal => {
        requireDeveloper();
        const endpoint = normalizeHorizonEndpoint(input);
        const nodes = snapshot.preferences.customNodes[id];
        if (endpoint === NETWORKS[id].horizonUrl || nodes.includes(endpoint)) throw new Error('duplicate-node');
        if (nodes.length >= 20) throw new Error('node-limit');
        await verify(id, endpoint, signal);
        save(
          { ...snapshot.preferences, customNodes: { ...snapshot.preferences.customNodes, [id]: [...nodes, endpoint] } },
          signal,
          false,
        );
      });
    },
    testNode(id: NetworkId, input: string) {
      return run(async signal => {
        const endpoint = normalizeHorizonEndpoint(input);
        requireNode(id, endpoint);
        return test(id, endpoint, signal);
      });
    },
    selectNode(id: NetworkId, input: string) {
      return run(async signal => {
        const endpoint = normalizeHorizonEndpoint(input);
        requireNode(id, endpoint);
        deps.assertCanSwitch(id);
        await verify(id, endpoint, signal);
        save(
          {
            ...snapshot.preferences,
            selectionConfirmed: true,
            networkId: id,
            endpoints: { ...snapshot.preferences.endpoints, [id]: endpoint },
          },
          signal,
          true,
        );
      });
    },
    removeNode(id: NetworkId, input: string) {
      return run(async signal => {
        requireDeveloper();
        const endpoint = normalizeHorizonEndpoint(input);
        requireNode(id, endpoint);
        if (endpoint === NETWORKS[id].horizonUrl) throw new Error('built-in-node');
        const p = snapshot.preferences;
        const selected = p.endpoints[id] === endpoint;
        if (selected) await verify(id, NETWORKS[id].horizonUrl, signal);
        save(
          {
            ...p,
            endpoints: { ...p.endpoints, [id]: selected ? NETWORKS[id].horizonUrl : p.endpoints[id] },
            customNodes: { ...p.customNodes, [id]: p.customNodes[id].filter(node => node !== endpoint) },
          },
          signal,
          selected && p.networkId === id,
        );
      });
    },
    cancel() {
      active?.abort();
      if (!closed) publish({ ...snapshot, interruption: snapshot.interruption + 1 });
    },
    close() {
      closed = true;
      active?.abort();
      listeners.clear();
    },
  };
}
export type NetworkSettings = ReturnType<typeof createNetworkSettings>;
