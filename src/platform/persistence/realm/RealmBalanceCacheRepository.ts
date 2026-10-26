import type Realm from 'realm';
import {
  BALANCE_CACHE_SCHEMA_VERSION,
  assertBalanceCachePartition,
  normalizeBalanceCacheSnapshot,
  type BalanceCachePartition,
  type BalanceCacheRepository,
  type BalanceCacheSnapshot,
} from '../../../capabilities/balance/BalanceCacheRepository';
import { BALANCE_CACHE_SNAPSHOT_ENTITY } from './schemas';

export class RealmBalanceCacheRepository implements BalanceCacheRepository {
  constructor(private readonly realm: Realm) {}
  getSnapshot(partition: BalanceCachePartition): BalanceCacheSnapshot | undefined {
    assertBalanceCachePartition(partition);
    const object = this.realm.objectForPrimaryKey(BALANCE_CACHE_SNAPSHOT_ENTITY, key(partition));
    if (!object) return undefined;
    try {
      const record = object as unknown as {
        networkId: string;
        accountAddress: string;
        schemaVersion: number;
        lastSuccessfulUpdateAt: Date;
        balanceJson: string;
      };
      if (
        record.networkId !== partition.networkId ||
        record.accountAddress !== partition.accountAddress ||
        record.schemaVersion !== BALANCE_CACHE_SCHEMA_VERSION ||
        record.balanceJson.length > 2 * 1024 * 1024
      ) {
        throw new Error('balance-cache-corrupt');
      }
      return normalizeBalanceCacheSnapshot(partition, {
        schemaVersion: BALANCE_CACHE_SCHEMA_VERSION,
        lastSuccessfulUpdateAt: new Date(record.lastSuccessfulUpdateAt),
        balance: JSON.parse(record.balanceJson),
      });
    } catch {
      this.clearPartition(partition);
      return undefined;
    }
  }
  replaceSnapshot(partition: BalanceCachePartition, snapshot: BalanceCacheSnapshot): void {
    const normalized = normalizeBalanceCacheSnapshot(partition, snapshot);
    const record = {
      id: key(partition),
      networkId: partition.networkId,
      accountAddress: partition.accountAddress,
      schemaVersion: normalized.schemaVersion,
      lastSuccessfulUpdateAt: normalized.lastSuccessfulUpdateAt,
      balanceJson: JSON.stringify(normalized.balance),
    };
    this.realm.write(() => {
      const existing = this.realm.objectForPrimaryKey(BALANCE_CACHE_SNAPSHOT_ENTITY, record.id);
      if (existing) this.realm.delete(existing);
      this.realm.create(BALANCE_CACHE_SNAPSHOT_ENTITY, record);
    });
  }
  clearPartition(partition: BalanceCachePartition): void {
    assertBalanceCachePartition(partition);
    const object = this.realm.objectForPrimaryKey(BALANCE_CACHE_SNAPSHOT_ENTITY, key(partition));
    if (object) this.realm.write(() => this.realm.delete(object));
  }
}
function key(partition: BalanceCachePartition): string {
  return JSON.stringify([partition.networkId, partition.accountAddress]);
}
