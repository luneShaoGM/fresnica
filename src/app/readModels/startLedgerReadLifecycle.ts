import type { NodeReadSession } from './createNodeReadSession';
import type { AccountRecord } from '@capabilities/account/types';

import type {
  TransactionReconciliationCoordinator,
  TransactionReconciliationReason,
} from '../transaction/TransactionReconciliationCoordinator';
import type { LedgerReadInvalidationStore } from './LedgerReadInvalidationStore';
import type { InternetConnectivity, LedgerReadRuntime } from './LedgerReadRuntime';

type Dependencies = Readonly<{
  runtime: LedgerReadRuntime;
  node?: Pick<NodeReadSession, 'getSnapshot' | 'subscribe'>;
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
  const reconcile = (reason: TransactionReconciliationReason) => {
    if (
      stopped ||
      !foreground ||
      connectivity === 'offline' ||
      (dependencies.node && dependencies.node.getSnapshot().phase !== 'healthy')
    )
      return;
    dependencies.coordinator.reconcile(reason).catch(dependencies.onFailure);
  };
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
    if (reason !== 'offline') reconcile(reason);
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
  let stopNode: (() => void) | undefined;
  try {
    stopNode = dependencies.node?.subscribe(() => {
      if (dependencies.node?.getSnapshot().phase === 'healthy') reconcile('node-recovery');
    });
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
    stopNode?.();
    throw error;
  }

  return () => {
    if (stopped) return;
    stopped = true;
    stopNode?.();
    foreground = false;
    updateRuntime();
    try {
      stopConnectivity();
    } finally {
      stopAppState();
    }
  };
}
