import type {
  PendingSubmissionRecord,
  PendingSubmissionRepository,
} from '../../../capabilities/transaction/pendingSubmission';
import { isPendingSubmissionBlocking } from '../../../capabilities/transaction/pendingSubmission';

export class InMemoryPendingSubmissionRepository implements PendingSubmissionRepository {
  private readonly records = new Map<string, PendingSubmissionRecord>();

  create(record: PendingSubmissionRecord): void {
    if (this.records.has(record.id)) {
      throw new Error('pending-submission-already-exists');
    }
    if (this.findBlockingIntent(record.networkId, record.accountId, record.intentKey)) {
      throw new Error('pending-submission-intent-blocked');
    }
    this.records.set(record.id, record);
  }

  get(networkId: string, transactionHash: string): PendingSubmissionRecord | undefined {
    return this.records.get(this.id(networkId, transactionHash));
  }

  findBlockingIntent(networkId: string, accountId: string, intentKey: string): PendingSubmissionRecord | undefined {
    return [...this.records.values()].find(
      record =>
        record.networkId === networkId &&
        record.accountId === accountId &&
        record.intentKey === intentKey &&
        isPendingSubmissionBlocking(record),
    );
  }
  listUnresolved(networkId?: string): PendingSubmissionRecord[] {
    return [...this.records.values()].filter(
      record => isPendingSubmissionBlocking(record) && (networkId === undefined || record.networkId === networkId),
    );
  }

  markUncertain(networkId: string, transactionHash: string, checkedAt: Date): void {
    this.update(networkId, transactionHash, record => ({
      ...record,
      state: 'uncertain',
      lastCheckedAt: checkedAt,
      updatedAt: checkedAt,
    }));
  }

  markConfirmed(networkId: string, transactionHash: string, checkedAt: Date, ledger?: number): void {
    this.update(networkId, transactionHash, record => ({
      ...record,
      state: 'confirmed',
      lastCheckedAt: checkedAt,
      updatedAt: checkedAt,
      ...(ledger === undefined ? {} : { ledger }),
    }));
  }
  markRejected(networkId: string, transactionHash: string, checkedAt: Date, resultCode?: string): void {
    this.update(networkId, transactionHash, record => ({
      ...record,
      state: 'rejected',
      lastCheckedAt: checkedAt,
      updatedAt: checkedAt,
      ...(resultCode === undefined ? {} : { resultCode }),
    }));
  }

  markStillUnknown(networkId: string, transactionHash: string, checkedAt: Date): void {
    this.update(networkId, transactionHash, record => ({
      ...record,
      state: 'uncertain',
      lastCheckedAt: checkedAt,
      updatedAt: checkedAt,
    }));
  }

  private update(
    networkId: string,
    transactionHash: string,
    mutate: (record: PendingSubmissionRecord) => PendingSubmissionRecord,
  ): void {
    const id = this.id(networkId, transactionHash);
    const record = this.records.get(id);
    if (!record) throw new Error('pending-submission-not-found');
    this.records.set(id, mutate(record));
  }

  private id(networkId: string, transactionHash: string): string {
    return `${networkId}:${transactionHash}`;
  }
}
