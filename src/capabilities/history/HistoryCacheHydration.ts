import type { AccountRecord } from '../account/types';
import {
  HISTORY_CACHE_MAX_ENTRIES,
  HISTORY_CACHE_SCHEMA_VERSION,
  replaceHistoryCacheSnapshotBestEffort,
  type HistoryCachePartition,
  type HistoryCacheRepository,
  type HistoryCacheSnapshot,
} from './HistoryCacheRepository';
import type { HistoryDependencies } from './loadHistoryPage';
import type { HistoryEntry } from './types';

export type HistoryProductDependencies = HistoryDependencies &
  Readonly<{
    cache: Pick<HistoryCacheRepository, 'getSnapshot' | 'replaceSnapshot' | 'clearPartition'>;
    now: () => Date;
  }>;

export function historyCachePartition(
  dependencies: Pick<HistoryProductDependencies, 'networkId'>,
  account: AccountRecord,
): HistoryCachePartition | undefined {
  if (account.networkId !== dependencies.networkId) {
    throw new Error('history-network-mismatch');
  }
  if (account.identityKind !== 'classic') {
    return undefined;
  }
  return {
    networkId: account.networkId,
    accountAddress: account.address,
  };
}

export function readHistoryCacheSnapshotBestEffort(
  dependencies: Readonly<{
    networkId: string;
    cache: Pick<HistoryCacheRepository, 'getSnapshot'>;
  }>,
  account: AccountRecord,
): HistoryCacheSnapshot | undefined {
  const partition = historyCachePartition(dependencies, account);
  if (!partition) {
    return undefined;
  }

  try {
    return dependencies.cache.getSnapshot(partition);
  } catch {
    return undefined;
  }
}

export function buildHistoryCacheSnapshotFromOnlineEntries(
  cachedSnapshot: HistoryCacheSnapshot | undefined,
  onlineEntries: readonly HistoryEntry[],
  updatedAt: Date,
): HistoryCacheSnapshot {
  const entries = mergeOnlineEntriesWithCachedTail(onlineEntries, cachedSnapshot?.entries ?? []);
  const retainedEntries = new Map(entries.map(entry => [entry.id, entry] as const));
  const details =
    cachedSnapshot?.details.filter(detail => {
      const retained = retainedEntries.get(detail.operationId);
      return retained !== undefined && historyEntriesEqual(retained, detail.entry);
    }) ?? [];

  return {
    schemaVersion: HISTORY_CACHE_SCHEMA_VERSION,
    lastSuccessfulHorizonUpdateAt: new Date(updatedAt),
    entries,
    details,
  };
}

export function cacheHistoryOnlineEntriesBestEffort(
  dependencies: HistoryProductDependencies,
  account: AccountRecord,
  onlineEntries: readonly HistoryEntry[],
  updatedAt: Date = dependencies.now(),
): boolean {
  const partition = historyCachePartition(dependencies, account);
  if (!partition) {
    return false;
  }
  const cachedSnapshot = readHistoryCacheSnapshotBestEffort(dependencies, account);
  const snapshot = buildHistoryCacheSnapshotFromOnlineEntries(cachedSnapshot, onlineEntries, updatedAt);
  return replaceHistoryCacheSnapshotBestEffort(dependencies.cache, partition, snapshot);
}

export function clearHistoryCacheBestEffort(
  dependencies: Pick<HistoryProductDependencies, 'networkId' | 'cache'>,
  account: AccountRecord,
): boolean {
  const partition = historyCachePartition(dependencies, account);
  if (!partition) {
    return false;
  }

  try {
    dependencies.cache.clearPartition(partition);
    return true;
  } catch {
    return false;
  }
}

export function readCachedHistoryDetail(
  snapshot: HistoryCacheSnapshot | undefined,
  operationId: string,
): HistoryEntry | undefined {
  return snapshot?.details.find(detail => detail.operationId === operationId)?.entry;
}

export function cacheHistoryReadyDetailBestEffort(
  dependencies: HistoryProductDependencies,
  account: AccountRecord,
  entry: HistoryEntry,
): boolean {
  const partition = historyCachePartition(dependencies, account);
  if (!partition) {
    return false;
  }
  const snapshot = readHistoryCacheSnapshotBestEffort(dependencies, account);
  if (!snapshot) {
    return false;
  }

  const listEntry = snapshot.entries.find(candidate => candidate.id === entry.id);
  if (!listEntry || !historyEntriesEqual(listEntry, entry)) {
    return false;
  }

  const detailById = new Map(snapshot.details.map(detail => [detail.operationId, detail.entry] as const));
  detailById.set(entry.id, entry);
  const details = snapshot.entries.flatMap(candidate => {
    const detail = detailById.get(candidate.id);
    return detail ? [{ operationId: candidate.id, entry: detail }] : [];
  });

  return replaceHistoryCacheSnapshotBestEffort(dependencies.cache, partition, {
    ...snapshot,
    details,
  });
}

export function removeCachedHistoryDetailBestEffort(
  dependencies: HistoryProductDependencies,
  account: AccountRecord,
  operationId: string,
): boolean {
  const partition = historyCachePartition(dependencies, account);
  if (!partition) {
    return false;
  }
  const snapshot = readHistoryCacheSnapshotBestEffort(dependencies, account);
  if (!snapshot) {
    return false;
  }
  if (!snapshot.details.some(detail => detail.operationId === operationId)) {
    return true;
  }

  return replaceHistoryCacheSnapshotBestEffort(dependencies.cache, partition, {
    ...snapshot,
    details: snapshot.details.filter(detail => detail.operationId !== operationId),
  });
}

function mergeOnlineEntriesWithCachedTail(
  onlineEntries: readonly HistoryEntry[],
  cachedEntries: readonly HistoryEntry[],
): readonly HistoryEntry[] {
  const online = deduplicateEntries(onlineEntries);
  if (online.length === 0 || cachedEntries.length === 0) {
    return online.slice(0, HISTORY_CACHE_MAX_ENTRIES);
  }

  const cachedIndexById = new Map(cachedEntries.map((entry, index) => [entry.id, index] as const));
  let overlapIndex: number | undefined;
  for (let index = online.length - 1; index >= 0; index -= 1) {
    const cachedIndex = cachedIndexById.get(online[index].id);
    if (cachedIndex !== undefined) {
      overlapIndex = cachedIndex;
      break;
    }
  }

  if (overlapIndex === undefined) {
    return online.slice(0, HISTORY_CACHE_MAX_ENTRIES);
  }

  const merged = [...online];
  const seenIds = new Set(online.map(entry => entry.id));
  for (const entry of cachedEntries.slice(overlapIndex + 1)) {
    if (seenIds.has(entry.id)) {
      continue;
    }
    seenIds.add(entry.id);
    merged.push(entry);
    if (merged.length === HISTORY_CACHE_MAX_ENTRIES) {
      break;
    }
  }
  return merged;
}

function deduplicateEntries(entries: readonly HistoryEntry[]): HistoryEntry[] {
  const result: HistoryEntry[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.id)) {
      continue;
    }
    seen.add(entry.id);
    result.push(entry);
  }
  return result;
}

function historyEntriesEqual(left: HistoryEntry, right: HistoryEntry): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
