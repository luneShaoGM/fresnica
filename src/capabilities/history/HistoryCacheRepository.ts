import type { HistoryAsset, HistoryEntry, HistoryParticipant, HistoryParticipantRole } from './types';

export const HISTORY_CACHE_SCHEMA_VERSION = 1 as const;
export const HISTORY_CACHE_MAX_ENTRIES = 500;

export type HistoryCachePartition = Readonly<{
  networkId: string;
  accountAddress: string;
}>;

export type HistoryCachedDetail = Readonly<{
  operationId: string;
  entry: HistoryEntry;
}>;

export type HistoryCacheSnapshot = Readonly<{
  schemaVersion: typeof HISTORY_CACHE_SCHEMA_VERSION;
  lastSuccessfulHorizonUpdateAt: Date;
  entries: readonly HistoryEntry[];
  details: readonly HistoryCachedDetail[];
}>;

export interface HistoryCacheRepository {
  getSnapshot(partition: HistoryCachePartition): HistoryCacheSnapshot | undefined;
  replaceSnapshot(partition: HistoryCachePartition, snapshot: HistoryCacheSnapshot): void;
  clearPartition(partition: HistoryCachePartition): void;
}

export function normalizeHistoryCacheSnapshot(snapshot: HistoryCacheSnapshot): HistoryCacheSnapshot {
  if (snapshot.schemaVersion !== HISTORY_CACHE_SCHEMA_VERSION) {
    throw new Error('history-cache-schema-incompatible');
  }
  const updatedAt = new Date(snapshot.lastSuccessfulHorizonUpdateAt);
  if (Number.isNaN(updatedAt.getTime())) {
    throw new Error('history-cache-invalid-updated-at');
  }

  const entries: HistoryEntry[] = [];
  const seenEntryIds = new Set<string>();
  for (const entry of snapshot.entries) {
    const normalizedEntry = normalizeHistoryEntry(entry);
    if (seenEntryIds.has(normalizedEntry.id)) {
      continue;
    }
    seenEntryIds.add(normalizedEntry.id);
    entries.push(normalizedEntry);
    if (entries.length === HISTORY_CACHE_MAX_ENTRIES) {
      break;
    }
  }

  const retainedEntryIds = new Set(entries.map(entry => entry.id));
  const details: HistoryCachedDetail[] = [];
  const seenDetailIds = new Set<string>();
  for (const detail of snapshot.details) {
    if (!isNonEmptyString(detail.operationId) || detail.entry.id !== detail.operationId) {
      throw new Error('history-cache-invalid-detail');
    }
    const normalizedEntry = normalizeHistoryEntry(detail.entry);
    if (!retainedEntryIds.has(detail.operationId) || seenDetailIds.has(detail.operationId)) {
      continue;
    }
    seenDetailIds.add(detail.operationId);
    details.push(Object.freeze({ operationId: detail.operationId, entry: normalizedEntry }));
  }

  return Object.freeze({
    schemaVersion: HISTORY_CACHE_SCHEMA_VERSION,
    lastSuccessfulHorizonUpdateAt: updatedAt,
    entries: Object.freeze(entries.slice()),
    details: Object.freeze(details),
  });
}

export function assertHistoryCachePartition(partition: HistoryCachePartition): void {
  if (!isNonEmptyString(partition.networkId) || !isNonEmptyString(partition.accountAddress)) {
    throw new Error('history-cache-invalid-partition');
  }
}

function normalizeHistoryEntry(entry: HistoryEntry): HistoryEntry {
  assertHistoryEntry(entry);
  const base = {
    id: entry.id,
    pagingToken: entry.pagingToken,
    operationType: entry.operationType,
    occurredAt: entry.occurredAt,
    transactionHash: entry.transactionHash,
    sourceAccount: entry.sourceAccount,
  };

  switch (entry.kind) {
    case 'payment':
      return Object.freeze({
        ...base,
        kind: 'payment',
        direction: entry.direction,
        amount: entry.amount,
        asset: normalizeAsset(entry.asset),
        counterparty: entry.counterparty,
        participants: normalizeParticipantPair(entry.participants),
      });
    case 'create-account':
      return Object.freeze({
        ...base,
        kind: 'create-account',
        direction: entry.direction,
        startingBalance: entry.startingBalance,
        counterparty: entry.counterparty,
        participants: normalizeParticipantPair(entry.participants),
      });
    case 'change-trust':
      return Object.freeze({
        ...base,
        kind: 'change-trust',
        asset: normalizeCreditAsset(entry.asset),
        limit: entry.limit,
        participants: normalizeParticipantPair(entry.participants),
      });
    case 'unsupported':
      return Object.freeze({
        ...base,
        kind: 'unsupported',
        reason: entry.reason,
      });
  }
}

function normalizeAsset(asset: HistoryAsset): HistoryAsset {
  assertAsset(asset);
  return asset.kind === 'native' ? Object.freeze({ kind: 'native', code: 'XLM' }) : normalizeCreditAsset(asset);
}

function normalizeCreditAsset(
  asset: Extract<HistoryAsset, { kind: 'credit' }>,
): Extract<HistoryAsset, { kind: 'credit' }> {
  assertCreditAsset(asset);
  return Object.freeze({ kind: 'credit', code: asset.code, issuer: asset.issuer });
}

function normalizeParticipantPair(
  participants: readonly [HistoryParticipant, HistoryParticipant],
): readonly [HistoryParticipant, HistoryParticipant] {
  assertParticipantPair(participants);
  return Object.freeze([normalizeParticipant(participants[0]), normalizeParticipant(participants[1])]) as readonly [
    HistoryParticipant,
    HistoryParticipant,
  ];
}

function normalizeParticipant(participant: HistoryParticipant): HistoryParticipant {
  return Object.freeze({
    role: participant.role,
    identity: participant.identity,
    ...(participant.baseAccount === undefined ? {} : { baseAccount: participant.baseAccount }),
  });
}

function assertHistoryEntry(entry: HistoryEntry): void {
  if (
    !entry ||
    !isNonEmptyString(entry.id) ||
    !isNonEmptyString(entry.pagingToken) ||
    !isNonEmptyString(entry.operationType) ||
    !isNonEmptyString(entry.occurredAt) ||
    !isNonEmptyString(entry.transactionHash) ||
    !isNonEmptyString(entry.sourceAccount)
  ) {
    throw new Error('history-cache-invalid-entry');
  }

  switch (entry.kind) {
    case 'payment':
      assertDirection(entry.direction);
      assertNonEmpty(entry.amount);
      assertAsset(entry.asset);
      assertNonEmpty(entry.counterparty);
      assertParticipantPair(entry.participants);
      return;
    case 'create-account':
      assertDirection(entry.direction);
      assertNonEmpty(entry.startingBalance);
      assertNonEmpty(entry.counterparty);
      assertParticipantPair(entry.participants);
      return;
    case 'change-trust':
      assertCreditAsset(entry.asset);
      assertNonEmpty(entry.limit);
      assertParticipantPair(entry.participants);
      return;
    case 'unsupported':
      if (entry.reason !== 'operation-type' && entry.reason !== 'operation-shape') {
        throw new Error('history-cache-invalid-entry');
      }
      return;
    default:
      throw new Error('history-cache-invalid-entry');
  }
}

function assertDirection(value: string): void {
  if (value !== 'incoming' && value !== 'outgoing' && value !== 'self' && value !== 'neutral') {
    throw new Error('history-cache-invalid-entry');
  }
}

function assertAsset(asset: HistoryAsset): void {
  if (asset.kind === 'native') {
    if (asset.code !== 'XLM') {
      throw new Error('history-cache-invalid-entry');
    }
    return;
  }
  assertCreditAsset(asset);
}

function assertCreditAsset(asset: Extract<HistoryAsset, { kind: 'credit' }>): void {
  if (asset.kind !== 'credit' || !isNonEmptyString(asset.code) || !isNonEmptyString(asset.issuer)) {
    throw new Error('history-cache-invalid-entry');
  }
}

function assertParticipantPair(participants: readonly [HistoryParticipant, HistoryParticipant]): void {
  if (!Array.isArray(participants) || participants.length !== 2) {
    throw new Error('history-cache-invalid-entry');
  }
  for (const participant of participants) {
    if (
      !participantRole(participant.role) ||
      !isNonEmptyString(participant.identity) ||
      (participant.baseAccount !== undefined && !isNonEmptyString(participant.baseAccount))
    ) {
      throw new Error('history-cache-invalid-entry');
    }
  }
}

function participantRole(value: string): value is HistoryParticipantRole {
  return (
    value === 'sender' ||
    value === 'recipient' ||
    value === 'funder' ||
    value === 'created-account' ||
    value === 'trustor' ||
    value === 'issuer'
  );
}

function assertNonEmpty(value: string): void {
  if (!isNonEmptyString(value)) {
    throw new Error('history-cache-invalid-entry');
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}
