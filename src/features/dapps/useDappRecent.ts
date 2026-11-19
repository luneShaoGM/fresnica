import { useSyncExternalStore } from 'react';
import type { DappRecentHistory, DappRecentSnapshot } from '@capabilities/dapp-interaction/dappRecentHistory';

const unavailable: DappRecentSnapshot = Object.freeze({ origins: [], unavailable: false });
const emptySubscribe = () => () => {};
const emptySnapshot = () => unavailable;

export function useDappRecent(history?: DappRecentHistory): DappRecentSnapshot {
  return useSyncExternalStore(
    history?.subscribe ?? emptySubscribe,
    history?.getSnapshot ?? emptySnapshot,
    history?.getSnapshot ?? emptySnapshot,
  );
}
