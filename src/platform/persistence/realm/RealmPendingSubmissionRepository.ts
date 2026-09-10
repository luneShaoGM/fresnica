import type Realm from 'realm';

import type {
  PendingSubmissionRecord,
  PendingSubmissionRepository,
  PendingSubmissionState,
} from '../../../capabilities/transaction/pendingSubmission';
import { isPendingSubmissionBlocking } from '../../../capabilities/transaction/pendingSubmission';
import { PENDING_SUBMISSION_ENTITY } from './schemas';
import type { PersistedPendingSubmission } from './types';

export class RealmPendingSubmissionRepository implements PendingSubmissionRepository {
  constructor(private readonly realm: Realm) {}

  create(record: PendingSubmissionRecord): void {
    this.realm.write(() => {
      if (this.realm.objectForPrimaryKey(PENDING_SUBMISSION_ENTITY, record.id)) {
        throw new Error('pending-submission-already-exists');
      }
      if (this.findBlockingIntent(record.networkId, record.accountId, record.intentKey)) {
        throw new Error('pending-submission-intent-blocked');
      }
      this.realm.create(PENDING_SUBMISSION_ENTITY, this.toPersisted(record));
    });
  }

  get(networkId: string, transactionHash: string): PendingSubmissionRecord | undefined {
    const record = this.realm.objectForPrimaryKey(PENDING_SUBMISSION_ENTITY, this.id(networkId, transactionHash));
    return record ? this.toDomain(record as unknown as PersistedPendingSubmission) : undefined;
  }
  findBlockingIntent(networkId: string, accountId: string, intentKey: string): PendingSubmissionRecord | undefined {
    return this.listAll().find(
      record =>
        record.networkId === networkId &&
        record.accountId === accountId &&
        record.intentKey === intentKey &&
        isPendingSubmissionBlocking(record),
    );
  }

  listUnresolved(networkId?: string): PendingSubmissionRecord[] {
    return this.listAll().filter(
      record => isPendingSubmissionBlocking(record) && (networkId === undefined || record.networkId === networkId),
    );
  }

  markUncertain(networkId: string, transactionHash: string, checkedAt: Date): void {
    this.update(networkId, transactionHash, record => {
      record.state = 'uncertain';
      record.lastCheckedAt = checkedAt;
      record.updatedAt = checkedAt;
    });
  }
  markConfirmed(networkId: string, transactionHash: string, checkedAt: Date, ledger?: number): void {
    this.update(networkId, transactionHash, record => {
      record.state = 'confirmed';
      record.lastCheckedAt = checkedAt;
      record.updatedAt = checkedAt;
      record.ledger = ledger ?? null;
    });
  }

  markRejected(networkId: string, transactionHash: string, checkedAt: Date, resultCode?: string): void {
    this.update(networkId, transactionHash, record => {
      record.state = 'rejected';
      record.lastCheckedAt = checkedAt;
      record.updatedAt = checkedAt;
      record.resultCode = resultCode ?? null;
    });
  }

  markStillUnknown(networkId: string, transactionHash: string, checkedAt: Date): void {
    this.markUncertain(networkId, transactionHash, checkedAt);
  }
  private listAll(): PendingSubmissionRecord[] {
    return Array.from(this.realm.objects(PENDING_SUBMISSION_ENTITY)).map(record =>
      this.toDomain(record as unknown as PersistedPendingSubmission),
    );
  }

  private update(
    networkId: string,
    transactionHash: string,
    mutate: (record: PersistedPendingSubmission) => void,
  ): void {
    this.realm.write(() => {
      const record = this.realm.objectForPrimaryKey(PENDING_SUBMISSION_ENTITY, this.id(networkId, transactionHash));
      if (!record) {
        throw new Error('pending-submission-not-found');
      }
      mutate(record as unknown as PersistedPendingSubmission);
    });
  }

  private toPersisted(record: PendingSubmissionRecord): PersistedPendingSubmission {
    return {
      ...record,
      lastCheckedAt: record.lastCheckedAt ?? null,
      ledger: record.ledger ?? null,
      resultCode: record.resultCode ?? null,
    };
  }
  private toDomain(record: PersistedPendingSubmission): PendingSubmissionRecord {
    const state = this.state(record.state);
    return {
      id: record.id,
      networkId: record.networkId,
      accountId: record.accountId,
      sourceAddress: record.sourceAddress,
      transactionHash: record.transactionHash,
      intentKind: record.intentKind,
      intentKey: record.intentKey,
      state,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
      ...(record.lastCheckedAt ? { lastCheckedAt: new Date(record.lastCheckedAt) } : {}),
      ...(record.ledger === null || record.ledger === undefined ? {} : { ledger: record.ledger }),
      ...(record.resultCode ? { resultCode: record.resultCode } : {}),
    };
  }

  private state(value: string): PendingSubmissionState {
    if (value === 'submitting' || value === 'uncertain' || value === 'confirmed' || value === 'rejected') {
      return value;
    }
    throw new Error(`invalid-pending-submission-state:${value}`);
  }

  private id(networkId: string, transactionHash: string): string {
    return `${networkId}:${transactionHash}`;
  }
}
