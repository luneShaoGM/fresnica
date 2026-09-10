import type {PendingSubmissionRepository} from '@capabilities/transaction/pendingSubmission';

import {createTransactionReconciliationCoordinator} from '../TransactionReconciliationCoordinator';

const pendingRecord = {
  id: 'stellar-testnet:hash-1',
  networkId: 'stellar-testnet',
  accountId: 'account-1',
  sourceAddress: 'GSOURCE',
  transactionHash: 'hash-1',
  intentKind: 'payment',
  intentKey: '["payment","GDESTINATION","1.0000000"]',
  state: 'uncertain' as const,
  createdAt: new Date('2026-09-10T00:00:00.000Z'),
  updatedAt: new Date('2026-09-10T00:00:00.000Z'),
};

function repository(): jest.Mocked<PendingSubmissionRepository> {
  return {
    create: jest.fn(),
    get: jest.fn(),
    findBlockingIntent: jest.fn(),
    listUnresolved: jest.fn().mockReturnValue([pendingRecord]),
    markUncertain: jest.fn(),
    markConfirmed: jest.fn(),
    markRejected: jest.fn(),
    markStillUnknown: jest.fn(),
  };
}
describe('TransactionReconciliationCoordinator', () => {
  it('deduplicates concurrent reconciliation triggers and allows a later run', async () => {
    const pending = repository();
    let resolveOutcome: ((value: {status: 'still-unknown'; transactionHash: string}) => void) | undefined;
    const gateway = {
      loadTransactionOutcome: jest.fn(
        () =>
          new Promise<{status: 'still-unknown'; transactionHash: string}>(resolve => {
            resolveOutcome = resolve;
          }),
      ),
    };
    const onRunStart = jest.fn();
    const coordinator = createTransactionReconciliationCoordinator({
      gateway,
      repository: pending,
      readInvalidation: {invalidate: jest.fn()},
      networkId: 'stellar-testnet',
      onRunStart,
    });

    const coldStart = coordinator.reconcile('cold-start');
    expect(gateway.loadTransactionOutcome).toHaveBeenCalledTimes(1);
    expect(onRunStart).toHaveBeenCalledTimes(1);
    resolveOutcome?.({status: 'still-unknown', transactionHash: 'hash-1'});
    await coldStart;

    const foreground = coordinator.reconcile('foreground');
    expect(foreground).not.toBe(coldStart);
    expect(gateway.loadTransactionOutcome).toHaveBeenCalledTimes(2);
    expect(onRunStart).toHaveBeenNthCalledWith(2, 'foreground');
    resolveOutcome?.({status: 'still-unknown', transactionHash: 'hash-1'});
    await foreground;
  });

  it('queues one trailing reconciliation when a recovery trigger arrives during an active run', async () => {
    const pending = repository();
    const resolvers: Array<
      (value: {status: 'still-unknown'; transactionHash: string}) => void
    > = [];
    const gateway = {
      loadTransactionOutcome: jest.fn(
        () =>
          new Promise<{status: 'still-unknown'; transactionHash: string}>(resolve => {
            resolvers.push(resolve);
          }),
      ),
    };
    const onRunStart = jest.fn();
    const coordinator = createTransactionReconciliationCoordinator({
      gateway,
      repository: pending,
      readInvalidation: {invalidate: jest.fn()},
      networkId: 'stellar-testnet',
      onRunStart,
    });

    const coldStart = coordinator.reconcile('cold-start');
    const networkRecovery = coordinator.reconcile('network-recovery');

    expect(networkRecovery).toBe(coldStart);
    expect(gateway.loadTransactionOutcome).toHaveBeenCalledTimes(1);
    resolvers[0]?.({status: 'still-unknown', transactionHash: 'hash-1'});
    await new Promise<void>(resolve => {
      setTimeout(resolve, 0);
    });

    expect(gateway.loadTransactionOutcome).toHaveBeenCalledTimes(2);
    expect(onRunStart).toHaveBeenNthCalledWith(2, 'network-recovery');
    resolvers[1]?.({status: 'still-unknown', transactionHash: 'hash-1'});
    await coldStart;

    expect(gateway.loadTransactionOutcome).toHaveBeenCalledTimes(2);
  });
});
