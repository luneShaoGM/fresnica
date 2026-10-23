import type Realm from 'realm';

import type {
  BalanceCachePartition,
  BalanceCacheRecord,
  BalanceCacheRepository,
} from '../../../capabilities/balance/BalanceCacheRepository';
import {
  BALANCE_CACHE_SCHEMA_VERSION,
  assertBalanceCachePartition,
  deserializeBalanceCachePayload,
  normalizeBalanceCacheRecord,
  serializeBalanceCachePayload,
} from '../../../capabilities/balance/BalanceCacheRepository';
import { BALANCE_CACHE_SNAPSHOT_ENTITY } from './schemas';

type PersistedBalanceCacheSnapshot = Readonly<{
  id: string;
  networkId: string;
  accountAddress: string;
  schemaVersion: number;
  updatedAt: Date;
  snapshotJson: string;
}>;

export class RealmBalanceCacheRepository implements BalanceCacheRepository {
  constructor(private readonly realm: Realm) {}

  getSnapshot(partition: BalanceCachePartition): BalanceCacheRecord | undefined {
    assertBalanceCachePartition(partition);
    const object = this.realm.objectForPrimaryKey(BALANCE_CACHE_SNAPSHOT_ENTITY, partitionId(partition));
    if (!object) {
      return undefined;
    }

    try {
      const record = object as unknown as PersistedBalanceCacheSnapshot;
      if (record.networkId !== partition.networkId || record.accountAddress !== partition.accountAddress) {
        throw new Error('balance-cache-corrupt-partition');
      }
      if (record.schemaVersion !== BALANCE_CACHE_SCHEMA_VERSION) {
        this.clearPartition(partition);
        return undefined;
      }
      return deserializeBalanceCachePayload(record.snapshotJson, new Date(record.updatedAt));
    } catch {
      this.clearPartition(partition);
      return undefined;
    }
  }

  replaceSnapshot(partition: BalanceCachePartition, record: BalanceCacheRecord): void {
    assertBalanceCachePartition(partition);
    const normalized = normalizeBalanceCacheRecord(record);
    if (normalized.snapshot.address !== partition.accountAddress) {
      throw new Error('balance-cache-account-mismatch');
    }
    const persisted: PersistedBalanceCacheSnapshot = {
      id: partitionId(partition),
      networkId: partition.networkId,
      accountAddress: partition.accountAddress,
      schemaVersion: normalized.schemaVersion,
      updatedAt: new Date(normalized.updatedAt),
      snapshotJson: serializeBalanceCachePayload(normalized),
    };
    this.realm.write(() => {
      const existing = this.realm.objectForPrimaryKey(BALANCE_CACHE_SNAPSHOT_ENTITY, persisted.id);
      if (existing) {
        this.realm.delete(existing);
      }
      this.realm.create(BALANCE_CACHE_SNAPSHOT_ENTITY, persisted);
    });
  }

  clearPartition(partition: BalanceCachePartition): void {
    assertBalanceCachePartition(partition);
    const object = this.realm.objectForPrimaryKey(BALANCE_CACHE_SNAPSHOT_ENTITY, partitionId(partition));
    if (!object) {
      return;
    }
    this.realm.write(() => {
      this.realm.delete(object);
    });
  }
}

function partitionId(partition: BalanceCachePartition): string {
  return JSON.stringify([partition.networkId, partition.accountAddress]);
}
