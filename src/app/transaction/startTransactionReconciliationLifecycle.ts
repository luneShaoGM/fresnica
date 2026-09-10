import type {TransactionReconciliationCoordinator} from './TransactionReconciliationCoordinator';

export type AppLifecycleState = string | null | undefined;

type AppLifecycleEvent = string;

type Dependencies = Readonly<{
  coordinator: TransactionReconciliationCoordinator;
  currentAppState: AppLifecycleState;
  subscribeAppState: (listener: (state: AppLifecycleEvent) => void) => () => void;
  subscribeNetworkRecovery: (listener: () => void) => () => void;
}>;

export function startTransactionReconciliationLifecycle(dependencies: Dependencies): () => void {
  let previousAppState = dependencies.currentAppState;
  const trigger = (reason: Parameters<TransactionReconciliationCoordinator['reconcile']>[0]) => {
    void dependencies.coordinator.reconcile(reason).catch(() => undefined);
  };
  trigger('cold-start');

  const stopAppState = dependencies.subscribeAppState(nextAppState => {
    if (
      nextAppState === 'active' &&
      (previousAppState === 'background' || previousAppState === 'inactive')
    ) {
      trigger('foreground');
    }
    previousAppState = nextAppState;
  });

  const stopNetwork = dependencies.subscribeNetworkRecovery(() => {
    trigger('network-recovery');
  });

  return () => {
    stopNetwork();
    stopAppState();
  };
}
