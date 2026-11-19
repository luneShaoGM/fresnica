import { useSyncExternalStore } from 'react';
import type { DappRecentHistory, DappRecentSnapshot } from '@capabilities/dapp-interaction/dappRecentHistory';

const emptyState: DappRecentSnapshot = Object.freeze({ origins: [], unavailable: false });
const emptySubscribe = () => () => {};
const emptySnapshot = () => emptyState;

export function useDappRecent(history?: DappRecentHistory): DappRecentSnapshot {
  return useSyncExternalStore(
    history?.subscribe ?? emptySubscribe,
    history?.getSnapshot ?? emptySnapshot,
    history?.getSnapshot ?? emptySnapshot,
  );
}
