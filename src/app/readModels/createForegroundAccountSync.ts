import type { NodeReadSession } from './createNodeReadSession';
import type { AccountRecord } from '@capabilities/account/types';
import type { AccountEffectsPort, AccountSyncMode } from '@capabilities/account-sync/AccountEffects';
import type { LedgerReadInvalidationStore } from './LedgerReadInvalidationStore';
import type { LedgerReadRuntime } from './LedgerReadRuntime';

export const ACCOUNT_SYNC_TIMING = Object.freeze({
  coalesce: 250,
  maxReadWait: 30000,
  connect: 10000,
  probe: 8000,
  poll: 15000,
  inactivePoll: 60000,
  health: 30000,
  retry: 2000,
  maxRetry: 60000,
});
type Target = Pick<AccountRecord, 'id' | 'address' | 'networkId' | 'identityKind' | 'hidden'>;
type Snapshot = Readonly<{ accountId?: string; mode: AccountSyncMode }>;

export function createForegroundAccountSync(
  deps: Readonly<{
    networkId: string;
    runtime: LedgerReadRuntime;
    invalidation: LedgerReadInvalidationStore;
    effects: AccountEffectsPort;
    onFailure: () => void;
    isReading: (address: string) => boolean;
    random?: () => number;
    node?: Pick<NodeReadSession, 'getSnapshot' | 'subscribe'>;
  }>,
) {
  let selected: Target | undefined;
  let snapshot: Snapshot = Object.freeze({ mode: 'paused' });
  const listeners = new Set<() => void>();
  let closed = false;
  let stopSession = () => {};
  const publish = (mode: AccountSyncMode) => {
    if (snapshot.mode === mode && snapshot.accountId === selected?.id) return;
    snapshot = Object.freeze({ accountId: selected?.id, mode });
    listeners.forEach(listener => listener());
  };
  function restart() {
    stopSession();
    const state = deps.runtime.getSnapshot();
    const account = selected;
    if (
      closed ||
      !account ||
      !state.foreground ||
      state.connectivity === 'offline' ||
      (deps.node && deps.node.getSnapshot().phase !== 'healthy')
    ) {
      publish('paused');
      return;
    }
    let alive = true;
    let streamVersion = 0;
    let stopStream = () => {};
    let cursor: string | undefined;
    let probeToken: string | undefined;
    let probeInitialized = false;
    let inactive = false;
    let tickTimer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    let probeAgain = false;
    let probing: AbortController | undefined;
    const seen = new Set<string>();
    const timers = new Set<ReturnType<typeof setTimeout>>();
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let connectTimer: ReturnType<typeof setTimeout> | undefined;
    let dirtyTimer: ReturnType<typeof setTimeout> | undefined;
    const later = (callback: () => void, delay: number) => {
      const timer = setTimeout(() => {
        timers.delete(timer);
        if (alive) callback();
      }, delay);
      timers.add(timer);
      return timer;
    };
    const cancel = (timer: ReturnType<typeof setTimeout> | undefined) => {
      if (timer !== undefined) {
        clearTimeout(timer);
        timers.delete(timer);
      }
    };
    let dirtySince = 0;
    const flushDirty = () => {
      // Preserve a dirty follow-up without repeatedly superseding a slow current display read.
      if (deps.isReading(account.address) && performance.now() - dirtySince < ACCOUNT_SYNC_TIMING.maxReadWait) {
        dirtyTimer = later(flushDirty, ACCOUNT_SYNC_TIMING.coalesce);
        return;
      }
      dirtyTimer = undefined;
      deps.invalidation.refresh({ networkId: deps.networkId, accountId: account.id, reason: 'account-effects' });
    };
    const dirty = () => {
      if (dirtyTimer !== undefined) return;
      dirtySince = performance.now();
      dirtyTimer = later(flushDirty, ACCOUNT_SYNC_TIMING.coalesce);
    };
    const probe = () => {
      if (probing) {
        probeAgain = true;
        return;
      }
      const probeStreamVersion = streamVersion;
      const controller = new AbortController();
      probing = controller;
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const expiry = new Promise<never>((_, reject) => {
        if (deps.node) return; // Bound production reads use the shared node deadline.
        timeout = later(() => {
          controller.abort();
          reject(new Error('effects-probe-timeout'));
        }, ACCOUNT_SYNC_TIMING.probe);
      });
      const read = Promise.resolve().then(() => {
        if (!alive) return undefined;
        return deps.effects.latest(account.address, controller.signal);
      });
      Promise.race([read, expiry])
        .then(token => {
          if (!alive) return;
          // A probe from a retired stream must not downgrade its replacement.
          if (token === null && probeStreamVersion !== streamVersion) return;
          if (token === null) {
            const newlyInactive = !inactive;
            inactive = true;
            streamVersion += 1;
            cancel(connectTimer);
            connectTimer = undefined;
            cancel(retryTimer);
            retryTimer = undefined;
            stopStream();
            stopStream = () => {};
            publish('inactive');
            cancel(tickTimer);
            tickTimer = later(tick, ACCOUNT_SYNC_TIMING.inactivePoll);
            if (newlyInactive) dirty();
            probeInitialized = true;
            probeToken = undefined;
            return;
          }
          if (inactive) {
            inactive = false;
            cancel(tickTimer);
            tickTimer = later(tick, ACCOUNT_SYNC_TIMING.poll);
            probeInitialized = false;
            probeToken = undefined;
            dirty();
            connect();
          }
          // A newer REST checkpoint absent from the live stream reveals silent loss.
          if (
            probeInitialized &&
            token !== probeToken &&
            !seen.has(token ?? '') &&
            snapshot.mode === 'live' &&
            probeStreamVersion === streamVersion
          )
            fail(streamVersion);
          probeInitialized = true;
          probeToken = token;
          // Even unchanged effects must retry an earlier failed/delayed display read.
          if (!inactive) dirty();
        })
        .catch(() => {
          if (!alive) return;
          deps.onFailure();
          if (snapshot.mode === 'live' && probeStreamVersion === streamVersion) fail(streamVersion);
        })
        .finally(() => {
          cancel(timeout!);
          if (!alive) return;
          probing = undefined;
          if (probeAgain) {
            probeAgain = false;
            probe();
          }
        });
    };
    const fail = (version: number, resetCursor = false) => {
      if (!alive || version !== streamVersion || inactive) return;
      streamVersion += 1;
      cancel(connectTimer);
      connectTimer = undefined;
      stopStream();
      stopStream = () => {};
      if (resetCursor) cursor = undefined;
      publish('polling');
      dirty();
      if (!probing) probe();
      if (retryTimer === undefined) {
        const delay = Math.min(ACCOUNT_SYNC_TIMING.maxRetry, ACCOUNT_SYNC_TIMING.retry * 2 ** Math.min(attempts++, 5));
        retryTimer = later(
          () => {
            retryTimer = undefined;
            connect();
          },
          delay * (0.75 + (deps.random ?? Math.random)() * 0.25),
        );
      }
    };
    const connect = () => {
      if (!alive || inactive) return;
      const version = ++streamVersion;
      if (snapshot.mode !== 'polling') publish('connecting');
      connectTimer = later(() => fail(version), ACCOUNT_SYNC_TIMING.connect);
      try {
        const stop = deps.effects.open({
          address: account.address,
          cursor,
          onOpen: () => {
            if (!alive || version !== streamVersion) return;
            cancel(connectTimer);
            connectTimer = undefined;
            publish('live');
            // Reconcile after the server establishes its cursor, closing the initial/reconnect window.
            dirty();
            probe();
          },
          onEffect: token => {
            if (!alive || version !== streamVersion) return;
            if (seen.has(token)) return;
            attempts = 0;
            cursor = token;
            seen.add(token);
            if (seen.size > 512) seen.delete(seen.values().next().value!);
            dirty();
          },
          onFailure: reason => fail(version, reason === 'cursor-rejected'),
        });
        if (!alive || version !== streamVersion) stop();
        else stopStream = stop;
      } catch {
        fail(version);
      }
    };
    let liveTicks = 0;
    const tick = () => {
      // Keep the fallback cadence independent of when the stream last failed.
      if (
        inactive ||
        snapshot.mode !== 'live' ||
        ++liveTicks >= ACCOUNT_SYNC_TIMING.health / ACCOUNT_SYNC_TIMING.poll
      ) {
        liveTicks = 0;
        probe();
      }
      tickTimer = later(tick, inactive ? ACCOUNT_SYNC_TIMING.inactivePoll : ACCOUNT_SYNC_TIMING.poll);
    };
    stopSession = () => {
      if (!alive) return;
      alive = false;
      streamVersion += 1;
      timers.forEach(clearTimeout);
      timers.clear();
      probing?.abort();
      stopStream();
    };
    publish('connecting');
    connect();
    if (!probing) probe();
    tickTimer = later(tick, ACCOUNT_SYNC_TIMING.poll);
  }
  const unsubscribe = deps.runtime.subscribe(restart);
  const unsubscribeNode = deps.node?.subscribe(restart);
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setAccount(account: Target | undefined) {
      if (closed) return;
      const next =
        account && !account.hidden && account.networkId === deps.networkId && account.identityKind === 'classic'
          ? account
          : undefined;
      if (selected?.id === next?.id && selected?.address === next?.address) return;
      selected = next;
      restart();
    },
    close() {
      if (closed) return;
      closed = true;
      stopSession();
      unsubscribe();
      unsubscribeNode?.();
      listeners.clear();
    },
  };
}
export type ForegroundAccountSync = ReturnType<typeof createForegroundAccountSync>;
