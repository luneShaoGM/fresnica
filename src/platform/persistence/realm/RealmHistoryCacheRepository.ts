import type Realm from 'realm';

import type {
  HistoryCachePartition,
  HistoryCacheRepository,
  HistoryCacheSnapshot,
} from '../../../capabilities/history/HistoryCacheRepository';
import {
  HISTORY_CACHE_SCHEMA_VERSION,
  assertHistoryCachePartition,
  normalizeHistoryCacheSnapshot,
} from '../../../capabilities/history/HistoryCacheRepository';
import type { HistoryCachedDetail } from '../../../capabilities/history/HistoryCacheRepository';
import type { HistoryEntry } from '../../../capabilities/history/types';
import { HISTORY_CACHE_SNAPSHOT_ENTITY } from './schemas';
import type { PersistedHistoryCacheSnapshot } from './types';

export class RealmHistoryCacheRepository implements HistoryCacheRepository {
  constructor(private readonly realm: Realm) {}

  getSnapshot(partition: HistoryCachePartition): HistoryCacheSnapshot | undefined {
    assertHistoryCachePartition(partition);
    const id = this.partitionId(partition);
    const object = this.realm.objectForPrimaryKey(HISTORY_CACHE_SNAPSHOT_ENTITY, id);
    if (!object) {
      return undefined;
    }

    try {
      const record = object as unknown as PersistedHistoryCacheSnapshot;
      if (
        record.schemaVersion !== HISTORY_CACHE_SCHEMA_VERSION ||
        record.networkId !== partition.networkId ||
        record.accountAddress !== partition.accountAddress
      ) {
        throw new Error('history-cache-corrupt-partition');
      }

      return normalizeHistoryCacheSnapshot({
        schemaVersion: HISTORY_CACHE_SCHEMA_VERSION,
        lastSuccessfulHorizonUpdateAt: new Date(record.lastSuccessfulHorizonUpdateAt),
        entries: parseJson<HistoryEntry[]>(record.entriesJson),
        details: parseJson<HistoryCachedDetail[]>(record.detailsJson),
      });
    } catch {
      this.clearPartition(partition);
      return undefined;
    }
  }

  replaceSnapshot(partition: HistoryCachePartition, snapshot: HistoryCacheSnapshot): void {
    assertHistoryCachePartition(partition);
    const normalized = normalizeHistoryCacheSnapshot(snapshot);
    const persisted: PersistedHistoryCacheSnapshot = {
      id: this.partitionId(partition),
      networkId: partition.networkId,
      accountAddress: partition.accountAddress,
      schemaVersion: normalized.schemaVersion,
      lastSuccessfulHorizonUpdateAt: new Date(normalized.lastSuccessfulHorizonUpdateAt),
      entriesJson: JSON.stringify(normalized.entries),
      detailsJson: JSON.stringify(normalized.details),
    };

    this.realm.write(() => {
      const existing = this.realm.objectForPrimaryKey(HISTORY_CACHE_SNAPSHOT_ENTITY, persisted.id);
      if (existing) {
        this.realm.delete(existing);
      }
      this.realm.create(HISTORY_CACHE_SNAPSHOT_ENTITY, persisted);
    });
  }

  clearPartition(partition: HistoryCachePartition): void {
    assertHistoryCachePartition(partition);
    const object = this.realm.objectForPrimaryKey(HISTORY_CACHE_SNAPSHOT_ENTITY, this.partitionId(partition));
    if (!object) {
      return;
    }
    this.realm.write(() => {
      this.realm.delete(object);
    });
  }

  private partitionId(partition: HistoryCachePartition): string {
    return JSON.stringify([partition.networkId, partition.accountAddress]);
  }
}

function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}
