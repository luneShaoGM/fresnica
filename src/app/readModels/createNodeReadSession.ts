import { isNodeFault, NodeReadError, type NodeReadFailure } from '@capabilities/network/NodeReadError';
import type { NodeHealthSnapshot } from '@capabilities/network/NodeHealthMonitor';
import type { LedgerReadRuntime } from './LedgerReadRuntime';

export type NodeReadSnapshot = NodeHealthSnapshot;
export const NODE_READ_TIMING = Object.freeze({ timeout: 10000, retry: 2000, maxRetry: 60000, stable: 30000 });

export function createNodeReadSession(
  deps: Readonly<{
    endpoint: string;
    networkPassphrase: string;
    runtime: LedgerReadRuntime;
    probe: (endpoint: string, signal: AbortSignal) => Promise<string>;
    onState: (snapshot: NodeReadSnapshot) => void;
    random?: () => number;
  }>,
) {
  let endpoint = validateEndpoint(deps.endpoint);
  let generation = 0;
  let snapshot: NodeReadSnapshot = Object.freeze({ endpoint, generation, phase: 'paused' });
  let closed = false;
  let failures = 0;
  let retryAt = 0;
  let healthySince = 0;
  let lastFailure: NodeReadFailure | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const active = new Set<(error: NodeReadError) => void>();
  const listeners = new Set<() => void>();
  const available = () => {
    const state = deps.runtime.getSnapshot();
    return state.foreground && state.connectivity !== 'offline';
  };
  const publish = (phase: NodeReadSnapshot['phase']) => {
    snapshot = Object.freeze({ endpoint, generation, phase, ...(lastFailure ? { failure: lastFailure } : {}) });
    deps.onState(snapshot);
    listeners.forEach(listener => listener());
  };
  const cancelTimer = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  const replaceGeneration = () => {
    generation += 1;
    for (const cancel of [...active]) cancel(new NodeReadError('superseded'));
  };
  function schedule() {
    cancelTimer();
    if (closed || !available()) return;
    const remaining = retryAt - performance.now();
    if (remaining > 0) {
      // Chunk long Retry-After values without shortening the server's cooldown.
      const phase = lastFailure === 'wrong-network' ? 'wrong-network' : 'cooldown';
      if (snapshot.phase !== phase) publish(phase);
      timer = setTimeout(schedule, Math.min(remaining, NODE_READ_TIMING.maxRetry));
    } else check();
  }
  function reportFailure(error: unknown, lease: number) {
    if (closed || lease !== generation || !available() || !isNodeFault(error)) return;
    lastFailure = error.kind;
    const exponential = Math.min(NODE_READ_TIMING.maxRetry, NODE_READ_TIMING.retry * 2 ** Math.min(failures++, 5));
    const delay = exponential * (0.75 + (deps.random ?? Math.random)() * 0.25);
    retryAt = Math.max(retryAt, performance.now() + Math.max(delay, error.retryAfterMs ?? 0));
    replaceGeneration();
    publish(error.kind === 'wrong-network' ? 'wrong-network' : 'cooldown');
    schedule();
  }
  async function execute<T>(
    load: (signal: AbortSignal, endpoint: string) => Promise<T>,
    checking: boolean,
    externalSignal?: AbortSignal,
  ): Promise<T> {
    const lease = generation;
    const target = endpoint;
    const runtime = deps.runtime.getSnapshot();
    const controller = new AbortController();
    let cancel!: (error: NodeReadError) => void;
    const cancelled = new Promise<never>((_, reject) => {
      cancel = error => {
        reject(error);
        controller.abort();
      };
    });
    active.add(cancel);
    const onAbort = () => cancel(new NodeReadError('superseded'));
    externalSignal?.addEventListener('abort', onAbort, { once: true });
    if (externalSignal?.aborted) onAbort();
    const timeout = setTimeout(() => cancel(new NodeReadError('timeout')), NODE_READ_TIMING.timeout);
    const assertCurrent = () => {
      if (
        closed ||
        controller.signal.aborted ||
        lease !== generation ||
        runtime !== deps.runtime.getSnapshot() ||
        !available()
      )
        throw new NodeReadError('superseded');
      if (!checking && snapshot.phase !== 'healthy') throw new NodeReadError('cooldown');
    };
    try {
      const read = Promise.resolve().then(() => {
        assertCurrent();
        return load(controller.signal, target);
      });
      const value = await Promise.race([read, cancelled]);
      assertCurrent();
      if (!checking && performance.now() - healthySince >= NODE_READ_TIMING.stable) failures = 0;
      return value;
    } catch (error) {
      reportFailure(error, lease);
      throw error;
    } finally {
      clearTimeout(timeout);
      active.delete(cancel);
      externalSignal?.removeEventListener('abort', onAbort);
    }
  }
  function check() {
    if (closed || !available() || snapshot.phase === 'checking') return;
    replaceGeneration();
    publish('checking');
    const lease = generation;
    execute(async (signal, target) => {
      const passphrase = await deps.probe(target, signal);
      if (passphrase !== deps.networkPassphrase) throw new NodeReadError('wrong-network');
    }, true)
      .then(() => {
        if (closed || lease !== generation) return;
        retryAt = 0;
        lastFailure = undefined;
        healthySince = performance.now();
        publish('healthy');
      })
      .catch(() => {
        if (!closed && lease === generation) reportFailure(new NodeReadError('protocol'), lease);
      });
  }
  const runtimeChanged = () => {
    cancelTimer();
    replaceGeneration();
    publish('paused');
    schedule();
  };
  const unsubscribe = deps.runtime.subscribe(runtimeChanged);
  schedule();
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    run<T>(load: (signal: AbortSignal, endpoint: string) => Promise<T>, signal?: AbortSignal): Promise<T> {
      if (closed || !available()) return Promise.reject(new NodeReadError('paused'));
      if (snapshot.phase !== 'healthy') return Promise.reject(new NodeReadError('cooldown'));
      return execute(load, false, signal);
    },
    assertReady() {
      if (closed || !available() || snapshot.phase !== 'healthy') throw new NodeReadError('cooldown');
      return snapshot;
    },
    reportFailure,
    retry() {
      if (snapshot.phase !== 'healthy' && snapshot.phase !== 'checking') schedule();
    },
    replaceEndpoint(next: string) {
      const validated = validateEndpoint(next);
      if (closed || endpoint === validated) return;
      cancelTimer();
      replaceGeneration();
      endpoint = validated;
      retryAt = 0;
      failures = 0;
      lastFailure = undefined;
      publish('paused');
      schedule();
    },
    close() {
      if (closed) return;
      closed = true;
      cancelTimer();
      replaceGeneration();
      unsubscribe();
      publish('closed');
      listeners.clear();
    },
  };
}
function validateEndpoint(endpoint: string): string {
  const url = new URL(endpoint);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash)
    throw new Error('invalid-horizon-endpoint');
  return url.toString().replace(/\/$/, '');
}
export type NodeReadSession = ReturnType<typeof createNodeReadSession>;
