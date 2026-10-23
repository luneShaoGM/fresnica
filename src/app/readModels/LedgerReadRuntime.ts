import type { InternetConnectivity } from '../../platform/system/networkConnectivity';
export type { InternetConnectivity } from '../../platform/system/networkConnectivity';

export type LedgerReadRuntimeSnapshot = Readonly<{
  foreground: boolean;
  connectivity: InternetConnectivity;
}>;

export function createLedgerReadRuntime() {
  let snapshot: LedgerReadRuntimeSnapshot = { foreground: true, connectivity: 'unknown' };
  const listeners = new Set<() => void>();

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    update(next: LedgerReadRuntimeSnapshot) {
      if (next.foreground === snapshot.foreground && next.connectivity === snapshot.connectivity) return;
      snapshot = Object.freeze({ ...next });
      for (const listener of listeners) listener();
    },
  };
}

export type LedgerReadRuntime = ReturnType<typeof createLedgerReadRuntime>;
