import {
  assertBalanceCachePartition,
  normalizeBalanceCacheSnapshot,
  type BalanceCachePartition,
  type BalanceCacheRepository,
  type BalanceCacheSnapshot,
} from '../../../capabilities/balance/BalanceCacheRepository';

export class InMemoryBalanceCacheRepository implements BalanceCacheRepository {
  private readonly snapshots = new Map<string, BalanceCacheSnapshot>();
  getSnapshot(partition: BalanceCachePartition): BalanceCacheSnapshot | undefined {
    assertBalanceCachePartition(partition);
    const snapshot = this.snapshots.get(JSON.stringify([partition.networkId, partition.accountAddress]));
    return snapshot ? normalizeBalanceCacheSnapshot(partition, snapshot) : undefined;
  }
  replaceSnapshot(partition: BalanceCachePartition, snapshot: BalanceCacheSnapshot): void {
    this.snapshots.set(
      JSON.stringify([partition.networkId, partition.accountAddress]),
      normalizeBalanceCacheSnapshot(partition, snapshot),
    );
  }
  clearPartition(partition: BalanceCachePartition): void {
    assertBalanceCachePartition(partition);
    this.snapshots.delete(JSON.stringify([partition.networkId, partition.accountAddress]));
  }
}
