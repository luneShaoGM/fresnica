import type {TransactionReconciliationCoordinator} from '../TransactionReconciliationCoordinator';
import {startTransactionReconciliationLifecycle} from '../startTransactionReconciliationLifecycle';

describe('startTransactionReconciliationLifecycle', () => {
  it('routes cold start, foreground and network recovery through one coordinator', () => {
    const reconcile = jest.fn().mockResolvedValue([]);
    const coordinator = {reconcile} as TransactionReconciliationCoordinator;
    let appStateListener: ((state: 'active' | 'background' | 'inactive' | 'unknown' | 'extension') => void) | undefined;
    let networkRecoveryListener: (() => void) | undefined;
    const stopAppState = jest.fn();
    const stopNetwork = jest.fn();

    const stop = startTransactionReconciliationLifecycle({
      coordinator,
      currentAppState: 'active',
      subscribeAppState: listener => {
        appStateListener = listener;
        return stopAppState;
      },
      subscribeNetworkRecovery: listener => {
        networkRecoveryListener = listener;
        return stopNetwork;
      },
    });

    expect(reconcile).toHaveBeenCalledWith('cold-start');
    appStateListener?.('background');
    appStateListener?.('active');
    expect(reconcile).toHaveBeenCalledWith('foreground');

    networkRecoveryListener?.();
    expect(reconcile).toHaveBeenCalledWith('network-recovery');

    stop();
    expect(stopNetwork).toHaveBeenCalledTimes(1);
    expect(stopAppState).toHaveBeenCalledTimes(1);
  });
});
