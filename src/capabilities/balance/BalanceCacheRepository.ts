import type { BalanceSnapshot } from './types';
import { stroops } from '../stellar/classicAmounts';

export const BALANCE_CACHE_SCHEMA_VERSION = 1 as const;
export const BALANCE_CACHE_MAX_LINES = 2000;
export type BalanceCachePartition = Readonly<{ networkId: string; accountAddress: string }>;
export type CachedBalance = Exclude<BalanceSnapshot, { status: 'unsupported-account' }>;
export type BalanceCacheSnapshot = Readonly<{
  schemaVersion: typeof BALANCE_CACHE_SCHEMA_VERSION;
  lastSuccessfulUpdateAt: Date;
  balance: CachedBalance;
}>;
export interface BalanceCacheRepository {
  getSnapshot(partition: BalanceCachePartition): BalanceCacheSnapshot | undefined;
  replaceSnapshot(partition: BalanceCachePartition, snapshot: BalanceCacheSnapshot): void;
  clearPartition(partition: BalanceCachePartition): void;
}

export function assertBalanceCachePartition(partition: BalanceCachePartition): void {
  if (!text(partition.networkId, 256) || !text(partition.accountAddress, 256)) {
    throw new Error('balance-cache-invalid-partition');
  }
}

export function normalizeBalanceCacheSnapshot(
  partition: BalanceCachePartition,
  snapshot: BalanceCacheSnapshot,
): BalanceCacheSnapshot {
  assertBalanceCachePartition(partition);
  const updatedAt = new Date(snapshot.lastSuccessfulUpdateAt);
  const balance = snapshot.balance;
  if (
    snapshot.schemaVersion !== BALANCE_CACHE_SCHEMA_VERSION ||
    !Number.isFinite(updatedAt.getTime()) ||
    !balance ||
    balance.address !== partition.accountAddress
  )
    throw new Error('balance-cache-invalid-snapshot');
  if (balance.status === 'inactive') {
    return Object.freeze({
      schemaVersion: BALANCE_CACHE_SCHEMA_VERSION,
      lastSuccessfulUpdateAt: updatedAt,
      balance: Object.freeze({ status: 'inactive', address: balance.address }),
    });
  }
  if (
    balance.status !== 'active' ||
    !Array.isArray(balance.balances) ||
    balance.balances.length > BALANCE_CACHE_MAX_LINES ||
    !Number.isSafeInteger(balance.hiddenLiquidityPoolShareCount) ||
    balance.hiddenLiquidityPoolShareCount < 0
  ) {
    throw new Error('balance-cache-invalid-snapshot');
  }
  const seen = new Set<string>();
  const balances = balance.balances.map(line => {
    if (!line || !decimal(line.balance) || (line.limit !== undefined && !decimal(line.limit)))
      throw new Error('balance-cache-invalid-line');
    const asset = line.asset;
    if (
      !asset ||
      (asset.kind === 'native'
        ? asset.code !== 'XLM'
        : asset.kind !== 'credit' || !text(asset.code, 12) || !text(asset.issuer, 256))
    )
      throw new Error('balance-cache-invalid-asset');
    const normalizedAsset =
      asset.kind === 'native'
        ? { kind: 'native' as const, code: 'XLM' as const }
        : { kind: 'credit' as const, code: asset.code, issuer: asset.issuer };
    const key = JSON.stringify(normalizedAsset);
    if (seen.has(key)) throw new Error('balance-cache-duplicate-asset');
    seen.add(key);
    if (
      asset.kind === 'credit' &&
      (!optionalAmount(line.buyingLiabilities) ||
        !optionalAmount(line.sellingLiabilities) ||
        [line.isAuthorized, line.isAuthorizedToMaintainLiabilities, line.isClawbackEnabled].some(
          value => value !== undefined && typeof value !== 'boolean',
        ))
    )
      throw new Error('balance-cache-invalid-line');
    return Object.freeze({
      asset: Object.freeze(normalizedAsset),
      balance: line.balance,
      ...(line.limit === undefined ? {} : { limit: line.limit }),
      ...(asset.kind !== 'credit'
        ? {}
        : {
            ...(line.buyingLiabilities === undefined ? {} : { buyingLiabilities: line.buyingLiabilities }),
            ...(line.sellingLiabilities === undefined ? {} : { sellingLiabilities: line.sellingLiabilities }),
            ...(line.isAuthorized === undefined ? {} : { isAuthorized: line.isAuthorized }),
            ...(line.isAuthorizedToMaintainLiabilities === undefined
              ? {}
              : { isAuthorizedToMaintainLiabilities: line.isAuthorizedToMaintainLiabilities }),
            ...(line.isClawbackEnabled === undefined ? {} : { isClawbackEnabled: line.isClawbackEnabled }),
          }),
    });
  });
  return Object.freeze({
    schemaVersion: BALANCE_CACHE_SCHEMA_VERSION,
    lastSuccessfulUpdateAt: updatedAt,
    balance: Object.freeze({
      status: 'active',
      address: balance.address,
      balances: Object.freeze(balances),
      hiddenLiquidityPoolShareCount: balance.hiddenLiquidityPoolShareCount,
    }),
  });
}
function text(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max && value.trim() === value;
}
function decimal(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 64 && /^-?\d+(?:\.\d{1,7})?$/.test(value);
}
function optionalAmount(value: string | undefined): boolean {
  if (value === undefined) return true;
  try {
    stroops(value);
    return true;
  } catch {
    return false;
  }
}
