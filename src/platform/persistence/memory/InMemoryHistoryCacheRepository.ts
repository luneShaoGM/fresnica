import type {
  HistoryCachePartition,
  HistoryCacheRepository,
  HistoryCacheSnapshot,
} from '../../../capabilities/history/HistoryCacheRepository';
import {
  assertHistoryCachePartition,
  normalizeHistoryCacheSnapshot,
} from '../../../capabilities/history/HistoryCacheRepository';

export class InMemoryHistoryCacheRepository implements HistoryCacheRepository {
  private readonly snapshots = new Map<string, HistoryCacheSnapshot>();

  getSnapshot(partition: HistoryCachePartition): HistoryCacheSnapshot | undefined {
    assertHistoryCachePartition(partition);
    const snapshot = this.snapshots.get(this.partitionId(partition));
    return snapshot ? cloneSnapshot(snapshot) : undefined;
  }

  replaceSnapshot(partition: HistoryCachePartition, snapshot: HistoryCacheSnapshot): void {
    assertHistoryCachePartition(partition);
    const normalized = normalizeHistoryCacheSnapshot(snapshot);
    this.snapshots.set(this.partitionId(partition), cloneSnapshot(normalized));
  }

  clearPartition(partition: HistoryCachePartition): void {
    assertHistoryCachePartition(partition);
    this.snapshots.delete(this.partitionId(partition));
  }

  private partitionId(partition: HistoryCachePartition): string {
    return JSON.stringify([partition.networkId, partition.accountAddress]);
  }
}

function cloneSnapshot(snapshot: HistoryCacheSnapshot): HistoryCacheSnapshot {
  return normalizeHistoryCacheSnapshot({
    ...snapshot,
    lastSuccessfulHorizonUpdateAt: new Date(snapshot.lastSuccessfulHorizonUpdateAt),
    entries: snapshot.entries.map(entry => cloneJson(entry)),
    details: snapshot.details.map(detail => ({
      operationId: detail.operationId,
      entry: cloneJson(detail.entry),
    })),
  });
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
