import { CONTRACT_HOST_FUNCTIONS, mapContract } from './contractHistory';
import { isMaintenanceType, mapMaintenance } from './maintenanceHistory';
import { isClaimableClawbackType, mapClaimableClawback } from './claimableClawbackHistory';
import { isOfferType, isPoolType, mapOfferPool } from './offerPoolHistory';
import { isPathPaymentType, mapPathPayment } from './pathPaymentHistory';
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

export function replaceHistoryCacheSnapshotBestEffort(
  repository: Pick<HistoryCacheRepository, 'replaceSnapshot'>,
  partition: HistoryCachePartition,
  snapshot: HistoryCacheSnapshot,
): boolean {
  try {
    repository.replaceSnapshot(partition, snapshot);
    return true;
  } catch {
    return false;
  }
}

export function normalizeHistoryCacheSnapshot(
  snapshot: HistoryCacheSnapshot,
  partition?: HistoryCachePartition,
): HistoryCacheSnapshot {
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
    const normalizedEntry = normalizeHistoryEntry(entry, partition?.accountAddress);
    if (seenEntryIds.has(normalizedEntry.id)) {
      continue;
    }
    seenEntryIds.add(normalizedEntry.id);
    entries.push(normalizedEntry);
    if (entries.length === HISTORY_CACHE_MAX_ENTRIES) {
      break;
    }
  }

  const retainedEntriesById = new Map(entries.map(entry => [entry.id, entry] as const));
  const details: HistoryCachedDetail[] = [];
  const seenDetailIds = new Set<string>();
  for (const detail of snapshot.details) {
    if (!isNonEmptyString(detail.operationId) || detail.entry.id !== detail.operationId) {
      throw new Error('history-cache-invalid-detail');
    }
    const normalizedEntry = normalizeHistoryEntry(detail.entry, partition?.accountAddress);
    const retainedEntry = retainedEntriesById.get(detail.operationId);
    if (!retainedEntry || seenDetailIds.has(detail.operationId)) {
      continue;
    }
    if (!historyEntriesEqual(retainedEntry, normalizedEntry)) {
      throw new Error('history-cache-detail-mismatch');
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

function normalizeHistoryEntry(entry: HistoryEntry, accountAddress?: string): HistoryEntry {
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
    case 'maintenance': {
      if (!accountAddress) throw new Error('history-cache-invalid-partition');
      const reconstructed = mapMaintenance(
        {
          ...base,
          type: entry.operationType,
          successful: entry.successful,
          extendTo: entry.extendTo,
          bumpTo: entry.bumpTo,
        },
        accountAddress,
        base,
      );
      if (!reconstructed) throw new Error('history-cache-invalid-entry');
      return reconstructed;
    }
    case 'contract': {
      if (!accountAddress) throw new Error('history-cache-invalid-partition');
      if (entry.events !== undefined && (!Array.isArray(entry.events) || entry.events.length > 128))
        throw new Error('history-cache-invalid-entry');
      entry.events?.forEach(event => assertAsset(event.asset));
      const reconstructed = mapContract(
        {
          ...base,
          type: entry.operationType,
          successful: entry.successful,
          hostFunction: CONTRACT_HOST_FUNCTIONS[entry.hostFunction],
          contractId: entry.contractId,
          functionName: entry.functionName,
          assetBalanceChanges: entry.events,
        },
        accountAddress,
        base,
      );
      if (
        !reconstructed ||
        reconstructed.events?.some((event, index) => event.direction !== entry.events?.[index]?.direction)
      )
        throw new Error('history-cache-invalid-entry');
      return reconstructed;
    }
    case 'claimable-create':
    case 'claimable-reference':
    case 'clawback': {
      if (entry.kind !== 'claimable-reference') assertAsset(entry.asset);
      const account =
        accountAddress ??
        (entry.kind === 'claimable-create' && entry.role === 'claimant'
          ? entry.claimants[0]?.destination
          : entry.kind === 'clawback' && entry.role === 'holder'
            ? entry.holderBase
            : entry.sourceAccount);
      const reconstructed = mapClaimableClawback(
        {
          ...base,
          type: entry.operationType,
          successful: entry.successful,
          ...(entry.kind === 'claimable-create'
            ? { asset: entry.asset, amount: entry.amount, claimants: entry.claimants }
            : entry.kind === 'clawback'
              ? {
                  asset: entry.asset,
                  amount: entry.amount,
                  from: entry.holderBase,
                  ...(entry.holder === entry.holderBase ? {} : { fromMuxed: entry.holder }),
                }
              : {
                  balanceId: entry.balanceId,
                  ...(entry.operationType === 'claim_claimable_balance' ? { claimant: entry.sourceAccount } : {}),
                }),
        },
        account ?? '',
        base,
      );
      if (
        !reconstructed ||
        reconstructed.kind !== entry.kind ||
        (reconstructed.kind === 'clawback' &&
          entry.kind === 'clawback' &&
          (reconstructed.holder !== entry.holder || reconstructed.holderBase !== entry.holderBase)) ||
        ('role' in reconstructed && (!('role' in entry) || reconstructed.role !== entry.role))
      )
        throw new Error('history-cache-invalid-entry');
      return reconstructed;
    }
    case 'offer':
    case 'liquidity-pool': {
      if (entry.kind === 'offer') {
        assertAsset(entry.buyingAsset);
        assertAsset(entry.sellingAsset);
      } else {
        if (!Array.isArray(entry.reserves) || entry.reserves.length !== 2)
          throw new Error('history-cache-invalid-entry');
        entry.reserves.forEach(leg => assertAsset(leg.asset));
      }
      const reconstructed = mapOfferPool(
        { ...base, ...entry, type: entry.operationType },
        accountAddress ?? base.sourceAccount,
        base,
      );
      if (
        !reconstructed ||
        (entry.kind === 'offer' && reconstructed.kind === 'offer' && reconstructed.cancellation !== entry.cancellation)
      )
        throw new Error('history-cache-invalid-entry');
      return reconstructed;
    }
    case 'path-payment': {
      const [sender, recipient] = entry.participants;
      const reconstructed = mapPathPayment(
        {
          ...base,
          type: entry.operationType,
          successful: entry.successful,
          from: sender.baseAccount ?? sender.identity,
          ...(sender.baseAccount === undefined ? {} : { fromMuxed: sender.identity }),
          to: recipient.baseAccount ?? recipient.identity,
          ...(recipient.baseAccount === undefined ? {} : { toMuxed: recipient.identity }),
          sourceAmount: entry.sourceAmount,
          amount: entry.destinationAmount,
          sourceAsset: entry.sourceAsset,
          asset: entry.destinationAsset,
        },
        accountAddress ??
          (entry.direction === 'self' || entry.direction === 'outgoing'
            ? (sender.baseAccount ?? sender.identity)
            : entry.direction === 'incoming'
              ? (recipient.baseAccount ?? recipient.identity)
              : ''),
        base,
      );
      if (
        !reconstructed ||
        reconstructed.direction !== entry.direction ||
        reconstructed.counterparty !== entry.counterparty ||
        JSON.stringify(reconstructed.participants) !== JSON.stringify(normalizeParticipantPair(entry.participants))
      ) {
        throw new Error('history-cache-invalid-entry');
      }
      return reconstructed;
    }
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
    !Number.isFinite(Date.parse(entry.occurredAt)) ||
    !isNonEmptyString(entry.transactionHash) ||
    !isNonEmptyString(entry.sourceAccount)
  ) {
    throw new Error('history-cache-invalid-entry');
  }

  switch (entry.kind) {
    case 'maintenance':
      if (!isMaintenanceType(entry.operationType)) throw new Error('history-cache-invalid-entry');
      return;
    case 'contract':
      if (entry.operationType !== 'invoke_host_function') throw new Error('history-cache-invalid-entry');
      return;
    case 'claimable-create':
    case 'claimable-reference':
    case 'clawback':
      if (!isClaimableClawbackType(entry.operationType) && entry.operationType !== 'invoke_host_function')
        throw new Error('history-cache-invalid-entry');
      return;
    case 'offer':
      if (!isOfferType(entry.operationType)) throw new Error('history-cache-invalid-entry');
      return;
    case 'liquidity-pool':
      if (!isPoolType(entry.operationType)) throw new Error('history-cache-invalid-entry');
      return;
    case 'path-payment':
      assertAsset(entry.sourceAsset);
      assertAsset(entry.destinationAsset);
      assertParticipantPair(entry.participants);
      if (
        !isPathPaymentType(entry.operationType) ||
        entry.successful !== true ||
        entry.participants[0].role !== 'sender' ||
        entry.participants[1].role !== 'recipient'
      ) {
        throw new Error('history-cache-invalid-entry');
      }
      assertDirection(entry.direction);
      return;
    case 'payment':
      assertOperationFamily(entry.operationType, 'payment', entry.participants, 'sender', 'recipient');
      assertDirection(entry.direction);
      assertNonEmpty(entry.amount);
      assertAsset(entry.asset);
      assertNonEmpty(entry.counterparty);
      assertParticipantPair(entry.participants);
      assertNoBaseAccount(entry.participants[0]);
      if (
        entry.participants[1].baseAccount !== undefined &&
        entry.participants[1].baseAccount === entry.participants[1].identity
      ) {
        throw new Error('history-cache-invalid-entry');
      }
      return;
    case 'create-account':
      assertOperationFamily(entry.operationType, 'create_account', entry.participants, 'funder', 'created-account');
      assertDirection(entry.direction);
      assertNonEmpty(entry.startingBalance);
      assertNonEmpty(entry.counterparty);
      assertParticipantPair(entry.participants);
      assertNoBaseAccount(entry.participants[0]);
      assertNoBaseAccount(entry.participants[1]);
      return;
    case 'change-trust':
      assertOperationFamily(entry.operationType, 'change_trust', entry.participants, 'trustor', 'issuer');
      assertCreditAsset(entry.asset);
      assertNonEmpty(entry.limit);
      assertParticipantPair(entry.participants);
      assertNoBaseAccount(entry.participants[0]);
      assertNoBaseAccount(entry.participants[1]);
      if (
        entry.participants[0].identity !== entry.sourceAccount ||
        entry.participants[1].identity !== entry.asset.issuer
      ) {
        throw new Error('history-cache-invalid-entry');
      }
      return;
    case 'unsupported':
      if (
        (entry.reason === 'operation-type' && isSpecializedOperationType(entry.operationType)) ||
        (entry.reason === 'operation-shape' &&
          !isSpecializedOperationType(entry.operationType) &&
          !isPathPaymentType(entry.operationType) &&
          !isOfferType(entry.operationType) &&
          !isPoolType(entry.operationType) &&
          !isClaimableClawbackType(entry.operationType) &&
          entry.operationType !== 'invoke_host_function' &&
          !isMaintenanceType(entry.operationType))
      ) {
        throw new Error('history-cache-invalid-entry');
      }
      if (entry.reason !== 'operation-type' && entry.reason !== 'operation-shape') {
        throw new Error('history-cache-invalid-entry');
      }
      return;
    default:
      throw new Error('history-cache-invalid-entry');
  }
}

function historyEntriesEqual(left: HistoryEntry, right: HistoryEntry): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function assertOperationFamily(
  operationType: string,
  expectedOperationType: string,
  participants: readonly [HistoryParticipant, HistoryParticipant],
  firstRole: HistoryParticipantRole,
  secondRole: HistoryParticipantRole,
): void {
  assertParticipantPair(participants);
  if (
    operationType !== expectedOperationType ||
    participants[0].role !== firstRole ||
    participants[1].role !== secondRole
  ) {
    throw new Error('history-cache-invalid-entry');
  }
}

function assertNoBaseAccount(participant: HistoryParticipant): void {
  if (participant.baseAccount !== undefined) {
    throw new Error('history-cache-invalid-entry');
  }
}

function isSpecializedOperationType(value: string): boolean {
  return value === 'payment' || value === 'create_account' || value === 'change_trust';
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
