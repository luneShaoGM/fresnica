import type {
  BalanceCachePartition,
  BalanceCacheRecord,
  BalanceCacheRepository,
} from '../../../capabilities/balance/BalanceCacheRepository';
import {
  assertBalanceCachePartition,
  normalizeBalanceCacheRecord,
} from '../../../capabilities/balance/BalanceCacheRepository';

export class InMemoryBalanceCacheRepository implements BalanceCacheRepository {
  private readonly records = new Map<string, BalanceCacheRecord>();

  getSnapshot(partition: BalanceCachePartition): BalanceCacheRecord | undefined {
    assertBalanceCachePartition(partition);
    const record = this.records.get(partitionId(partition));
    return record ? normalizeBalanceCacheRecord(record) : undefined;
  }

  replaceSnapshot(partition: BalanceCachePartition, record: BalanceCacheRecord): void {
    assertBalanceCachePartition(partition);
    if (record.snapshot.address !== partition.accountAddress) {
      throw new Error('balance-cache-account-mismatch');
    }
    this.records.set(partitionId(partition), normalizeBalanceCacheRecord(record));
  }

  clearPartition(partition: BalanceCachePartition): void {
    assertBalanceCachePartition(partition);
    this.records.delete(partitionId(partition));
  }
}

function partitionId(partition: BalanceCachePartition): string {
  return JSON.stringify([partition.networkId, partition.accountAddress]);
}
