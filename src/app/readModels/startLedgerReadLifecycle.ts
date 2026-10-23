import type { AccountRecord } from '@capabilities/account/types';

import type {
  TransactionReconciliationCoordinator,
  TransactionReconciliationReason,
} from '../transaction/TransactionReconciliationCoordinator';
import type { LedgerReadInvalidationStore } from './LedgerReadInvalidationStore';
import type { InternetConnectivity, LedgerReadRuntime } from './LedgerReadRuntime';

type Dependencies = Readonly<{
  runtime: LedgerReadRuntime;
  invalidation: LedgerReadInvalidationStore;
  coordinator: TransactionReconciliationCoordinator;
  networkId: string;
  getAccounts: () => readonly AccountRecord[];
  currentAppState: string | null | undefined;
  subscribeAppState: (listener: (state: string) => void) => () => void;
  subscribeConnectivity: (listener: (state: InternetConnectivity) => void) => () => void;
  onFailure: (error: unknown) => void;
}>;

export function startLedgerReadLifecycle(dependencies: Dependencies): () => void {
  let stopped = false;
  let foreground = dependencies.currentAppState === 'active';
  let connectivity: InternetConnectivity = 'unknown';

  const updateRuntime = () => dependencies.runtime.update({ foreground, connectivity });
  const refresh = (reason: TransactionReconciliationReason | 'offline') => {
    try {
      for (const account of dependencies.getAccounts()) {
        if (!account.hidden && account.networkId === dependencies.networkId) {
          dependencies.invalidation.refresh({ networkId: account.networkId, accountId: account.id, reason });
        }
      }
    } catch (error) {
      dependencies.onFailure(error);
    }
    if (reason !== 'offline' && foreground && connectivity !== 'offline') {
      void dependencies.coordinator.reconcile(reason).catch(dependencies.onFailure);
    }
  };

  updateRuntime();
  if (foreground) refresh('cold-start');

  const stopAppState = dependencies.subscribeAppState(state => {
    if (stopped) return;
    const wasForeground = foreground;
    foreground = state === 'active';
    updateRuntime();
    if (foreground && !wasForeground) refresh('foreground');
  });
  let stopConnectivity: () => void;
  try {
    stopConnectivity = dependencies.subscribeConnectivity(state => {
      if (stopped || state === 'unknown' || state === connectivity) return;
      connectivity = state;
      updateRuntime();
      if (foreground) refresh(state === 'online' ? 'network-recovery' : 'offline');
    });
  } catch (error) {
    stopped = true;
    foreground = false;
    updateRuntime();
    stopAppState();
    throw error;
  }

  return () => {
    if (stopped) return;
    stopped = true;
    foreground = false;
    updateRuntime();
    try {
      stopConnectivity();
    } finally {
      stopAppState();
    }
  };
}
