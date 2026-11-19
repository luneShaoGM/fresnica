import { readPublicDappNavigation } from './externalDappUrl';

export const DAPP_RECENT_LIMIT = 10;
export type DappRecentRepository = Readonly<{
  read: (networkId: string) => readonly string[];
  replace: (networkId: string, origins: readonly string[]) => void;
}>;
export type DappRecentSnapshot = Readonly<{ origins: readonly string[]; unavailable: boolean }>;
export type DappRecentHistory = Readonly<{
  getSnapshot: () => DappRecentSnapshot;
  subscribe: (listener: () => void) => () => void;
  record: (url: string) => void;
  retry: () => void;
  close: () => void;
}>;

// Persistence accepts canonical public origins only, never a full launch URL.
export function isDappRecentOrigins(value: unknown): value is readonly string[] {
  return (
    Array.isArray(value) &&
    value.length <= DAPP_RECENT_LIMIT &&
    new Set(value).size === value.length &&
    value.every(origin => typeof origin === 'string' && readPublicDappNavigation(origin)?.origin === origin)
  );
}

export function createDappRecentHistory(repository: DappRecentRepository, networkId: string): DappRecentHistory {
  let closed = false;
  let state: DappRecentSnapshot = { origins: [], unavailable: false };
  const listeners = new Set<() => void>();
  const publish = (origins: readonly string[], unavailable: boolean) => {
    state = Object.freeze({ origins: Object.freeze([...origins]), unavailable });
    listeners.forEach(listener => listener());
  };
  const retry = () => {
    if (closed) return;
    try {
      const origins = repository.read(networkId);
      if (!isDappRecentOrigins(origins)) throw new Error('dapp-recent-invalid');
      publish(origins, false);
    } catch {
      publish(state.origins, true);
    }
  };
  retry();
  return {
    getSnapshot: () => state,
    subscribe: listener => {
      if (closed) return () => {};
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    record: url => {
      if (closed) return;
      const origin = readPublicDappNavigation(url)?.origin;
      if (!origin) return;
      if (state.unavailable) retry();
      if (state.unavailable) return;
      const origins = [origin, ...state.origins.filter(item => item !== origin)].slice(0, DAPP_RECENT_LIMIT);
      try {
        repository.replace(networkId, origins);
        publish(origins, false);
      } catch {
        // A successful browser handoff stays successful when history cannot save.
        publish(state.origins, true);
      }
    },
    retry,
    close: () => {
      closed = true;
      listeners.clear();
    },
  };
}
