import type { PendingSubmissionRecord, PendingSubmissionRepository } from '../pendingSubmission';
import { createTransactionIntentIdentity } from '../pendingSubmission';
import { reconcilePendingSubmissions } from '../reconcilePendingSubmissions';

const createdAt = new Date('2026-09-10T00:00:00.000Z');
const checkedAt = new Date('2026-09-10T00:01:00.000Z');

function record(transactionHash: string): PendingSubmissionRecord {
  return {
    id: `stellar-testnet:${transactionHash}`,
    networkId: 'stellar-testnet',
    accountId: 'account-1',
    sourceAddress: 'GSOURCE',
    transactionHash,
    intentKind: 'payment',
    intentKey: '["payment","GDESTINATION","1.0000000"]',
    state: 'uncertain',
    createdAt,
    updatedAt: createdAt,
  };
}

function repository(records: PendingSubmissionRecord[]) {
  return {
    create: jest.fn(),
    get: jest.fn(),
    findBlockingIntent: jest.fn(),
    listUnresolved: jest.fn().mockReturnValue(records),
    markUncertain: jest.fn(),
    markConfirmed: jest.fn(),
    markRejected: jest.fn(),
    markStillUnknown: jest.fn(),
  } satisfies jest.Mocked<PendingSubmissionRepository>;
}

describe('pending submission reconciliation', () => {
  it('creates a stable intent identity without flattening component boundaries', () => {
    expect(createTransactionIntentIdentity(' payment ', ['GDESTINATION', '1.0000000'])).toEqual({
      kind: 'payment',
      key: '["payment","GDESTINATION","1.0000000"]',
    });
    expect(() => createTransactionIntentIdentity(' ', [])).toThrow('invalid-transaction-intent-kind');
  });

  it('records confirmed, rejected and still-unknown outcomes by exact hash', async () => {
    const records = [record('confirmed-hash'), record('rejected-hash'), record('unknown-hash')];
    const pending = repository(records);
    const readInvalidation = {invalidate: jest.fn()};
    const gateway = {
      loadTransactionOutcome: jest
        .fn()
        .mockResolvedValueOnce({
          status: 'confirmed',
          transactionHash: 'confirmed-hash',
          ledger: 77,
        })
        .mockResolvedValueOnce({
          status: 'rejected',
          transactionHash: 'rejected-hash',
          resultCode: 'tx_bad_seq',
        })
        .mockResolvedValueOnce({
          status: 'still-unknown',
          transactionHash: 'unknown-hash',
        }),
    };

    await expect(
      reconcilePendingSubmissions({
        gateway,
        repository: pending,
        readInvalidation,
        networkId: 'stellar-testnet',
        now: () => checkedAt,
      }),
    ).resolves.toEqual([
      { transactionHash: 'confirmed-hash', status: 'confirmed' },
      { transactionHash: 'rejected-hash', status: 'rejected' },
      { transactionHash: 'unknown-hash', status: 'still-unknown' },
    ]);

    expect(pending.listUnresolved).toHaveBeenCalledWith('stellar-testnet');
    expect(readInvalidation.invalidate).toHaveBeenCalledTimes(3);
    expect(readInvalidation.invalidate).toHaveBeenCalledWith({
      networkId: 'stellar-testnet',
      accountId: 'account-1',
      transactionHash: 'unknown-hash',
    });
    expect(pending.markConfirmed).toHaveBeenCalledWith('stellar-testnet', 'confirmed-hash', checkedAt, 77);
    expect(pending.markRejected).toHaveBeenCalledWith('stellar-testnet', 'rejected-hash', checkedAt, 'tx_bad_seq');
    expect(pending.markStillUnknown).toHaveBeenCalledWith('stellar-testnet', 'unknown-hash', checkedAt);
  });

  it.each([
    ['confirmed', {status: 'confirmed' as const, transactionHash: 'different-hash', ledger: 77}],
    [
      'rejected',
      {
        status: 'rejected' as const,
        transactionHash: 'different-hash',
        resultCode: 'tx_bad_seq',
      },
    ],
    ['still-unknown', {status: 'still-unknown' as const, transactionHash: 'different-hash'}],
  ])('keeps the original pending record unresolved when a %s outcome returns a different hash', async (_status, outcome) => {
    const pending = repository([record('expected-hash')]);

    const results = await reconcilePendingSubmissions({
      gateway: {loadTransactionOutcome: jest.fn().mockResolvedValue(outcome)},
      repository: pending,
      readInvalidation: {invalidate: jest.fn()},
      now: () => checkedAt,
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      transactionHash: 'expected-hash',
      status: 'check-failed',
      error: expect.objectContaining({message: 'transaction-reconciliation-hash-mismatch'}),
    });
    expect(pending.markConfirmed).not.toHaveBeenCalled();
    expect(pending.markRejected).not.toHaveBeenCalled();
    expect(pending.markStillUnknown).not.toHaveBeenCalled();
  });

  it('keeps a pending record unresolved when its lookup fails', async () => {
    const pending = repository([record('offline-hash')]);
    const error = new Error('offline');

    await expect(
      reconcilePendingSubmissions({
        gateway: { loadTransactionOutcome: jest.fn().mockRejectedValue(error) },
        repository: pending,
        readInvalidation: {invalidate: jest.fn()},
        now: () => checkedAt,
      }),
    ).resolves.toEqual([{ transactionHash: 'offline-hash', status: 'check-failed', error }]);

    expect(pending.markConfirmed).not.toHaveBeenCalled();
    expect(pending.markRejected).not.toHaveBeenCalled();
    expect(pending.markStillUnknown).not.toHaveBeenCalled();
  });
});
