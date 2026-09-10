import type {LedgerReadInvalidationPort} from './LedgerReadInvalidation';
import type { PendingSubmissionRecord, PendingSubmissionRepository } from './pendingSubmission';
import type { TransactionGatewayPort } from './TransactionGateway';

export type PendingSubmissionReconciliation = Readonly<{
  transactionHash: string;
  status: 'confirmed' | 'rejected' | 'still-unknown' | 'check-failed';
  error?: unknown;
}>;

export async function reconcilePendingSubmissions(input: {
  gateway: Pick<TransactionGatewayPort, 'loadTransactionOutcome'>;
  repository: PendingSubmissionRepository;
  readInvalidation: LedgerReadInvalidationPort;
  networkId?: string;
  now?: () => Date;
}): Promise<PendingSubmissionReconciliation[]> {
  const now = input.now ?? (() => new Date());
  const records = input.repository.listUnresolved(input.networkId);
  const results: PendingSubmissionReconciliation[] = [];

  for (const record of records) {
    results.push(
      await reconcileOne(input.gateway, input.repository, input.readInvalidation, record, now),
    );
  }

  return results;
}
async function reconcileOne(
  gateway: Pick<TransactionGatewayPort, 'loadTransactionOutcome'>,
  repository: PendingSubmissionRepository,
  readInvalidation: LedgerReadInvalidationPort,
  record: PendingSubmissionRecord,
  now: () => Date,
): Promise<PendingSubmissionReconciliation> {
  readInvalidation.invalidate({
    networkId: record.networkId,
    accountId: record.accountId,
    transactionHash: record.transactionHash,
  });

  try {
    const outcome = await gateway.loadTransactionOutcome(record.transactionHash);
    const checkedAt = now();

    switch (outcome.status) {
      case 'confirmed':
        repository.markConfirmed(record.networkId, record.transactionHash, checkedAt, outcome.ledger);
        return { transactionHash: record.transactionHash, status: 'confirmed' };
      case 'rejected':
        repository.markRejected(record.networkId, record.transactionHash, checkedAt, outcome.resultCode);
        return { transactionHash: record.transactionHash, status: 'rejected' };
      case 'still-unknown':
        repository.markStillUnknown(record.networkId, record.transactionHash, checkedAt);
        return { transactionHash: record.transactionHash, status: 'still-unknown' };
    }
  } catch (error) {
    return {
      transactionHash: record.transactionHash,
      status: 'check-failed',
      error,
    };
  }
}
