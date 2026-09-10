import type { PendingSubmissionRecord } from '../../../../capabilities/transaction/pendingSubmission';
import { InMemoryPendingSubmissionRepository } from '../InMemoryPendingSubmissionRepository';

const createdAt = new Date('2026-09-10T00:00:00.000Z');

function record(): PendingSubmissionRecord {
  return {
    id: 'stellar-testnet:transaction-hash',
    networkId: 'stellar-testnet',
    accountId: 'account-1',
    sourceAddress: 'GSOURCE',
    transactionHash: 'transaction-hash',
    intentKind: 'payment',
    intentKey: '["payment","GDESTINATION","1.0000000"]',
    state: 'submitting',
    createdAt,
    updatedAt: createdAt,
  };
}

describe('InMemoryPendingSubmissionRepository', () => {
  it('blocks a matching unresolved intent and releases it after confirmation', () => {
    const repository = new InMemoryPendingSubmissionRepository();
    const pending = record();
    const checkedAt = new Date('2026-09-10T00:01:00.000Z');

    repository.create(pending);
    expect(repository.findBlockingIntent(pending.networkId, pending.accountId, pending.intentKey)).toEqual(pending);

    repository.markConfirmed(pending.networkId, pending.transactionHash, checkedAt, 77);

    expect(repository.findBlockingIntent(pending.networkId, pending.accountId, pending.intentKey)).toBeUndefined();
    expect(repository.get(pending.networkId, pending.transactionHash)).toMatchObject({
      state: 'confirmed',
      lastCheckedAt: checkedAt,
      ledger: 77,
    });
  });

  it('rejects duplicate records and keeps unknown submissions blocking', () => {
    const repository = new InMemoryPendingSubmissionRepository();
    const pending = record();
    const checkedAt = new Date('2026-09-10T00:01:00.000Z');

    repository.create(pending);
    expect(() => repository.create(pending)).toThrow('pending-submission-already-exists');

    repository.markStillUnknown(pending.networkId, pending.transactionHash, checkedAt);
    expect(repository.listUnresolved()).toEqual([
      expect.objectContaining({ state: 'uncertain', lastCheckedAt: checkedAt }),
    ]);
  });
});
