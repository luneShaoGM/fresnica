import type { BalanceAsset, BalanceLine, BalanceSnapshot } from './types';

export const BALANCE_CACHE_SCHEMA_VERSION = 1 as const;

export type BalanceCachePartition = Readonly<{
  networkId: string;
  accountAddress: string;
}>;

export type CachedSpendableAsset = Readonly<{
  asset: BalanceAsset;
  balance: string;
  spendable: string;
}>;

export type BalanceCacheRecord = Readonly<{
  schemaVersion: typeof BALANCE_CACHE_SCHEMA_VERSION;
  updatedAt: Date;
  snapshot: BalanceSnapshot;
  spendableAssets?: readonly CachedSpendableAsset[];
  baseFeeStroops?: number;
}>;

export interface BalanceCacheRepository {
  getSnapshot(partition: BalanceCachePartition): BalanceCacheRecord | undefined;
  replaceSnapshot(partition: BalanceCachePartition, record: BalanceCacheRecord): void;
  clearPartition(partition: BalanceCachePartition): void;
}

export function assertBalanceCachePartition(partition: BalanceCachePartition): void {
  if (!partition.networkId || !partition.accountAddress) {
    throw new Error('balance-cache-invalid-partition');
  }
}

export function serializeBalanceCachePayload(record: BalanceCacheRecord): string {
  return JSON.stringify({
    snapshot: record.snapshot,
    ...(record.spendableAssets === undefined ? {} : { spendableAssets: record.spendableAssets }),
    ...(record.baseFeeStroops === undefined ? {} : { baseFeeStroops: record.baseFeeStroops }),
  });
}

export function deserializeBalanceCachePayload(snapshotJson: string, updatedAt: Date): BalanceCacheRecord {
  const parsed: unknown = JSON.parse(snapshotJson);
  if (isBalanceCachePayload(parsed)) {
    return normalizeBalanceCacheRecord({
      schemaVersion: BALANCE_CACHE_SCHEMA_VERSION,
      updatedAt,
      snapshot: parsed.snapshot,
      ...(parsed.spendableAssets === undefined ? {} : { spendableAssets: parsed.spendableAssets }),
      ...(parsed.baseFeeStroops === undefined ? {} : { baseFeeStroops: parsed.baseFeeStroops }),
    });
  }
  if (isBalanceSnapshot(parsed)) {
    return normalizeBalanceCacheRecord({
      schemaVersion: BALANCE_CACHE_SCHEMA_VERSION,
      updatedAt,
      snapshot: parsed,
    });
  }
  throw new Error('balance-cache-invalid-record');
}

export function normalizeBalanceCacheRecord(record: BalanceCacheRecord): BalanceCacheRecord {
  if (record.schemaVersion !== BALANCE_CACHE_SCHEMA_VERSION) {
    throw new Error('balance-cache-schema-incompatible');
  }
  if (!(record.updatedAt instanceof Date) || Number.isNaN(record.updatedAt.getTime())) {
    throw new Error('balance-cache-invalid-record');
  }
  return Object.freeze({
    schemaVersion: BALANCE_CACHE_SCHEMA_VERSION,
    updatedAt: new Date(record.updatedAt),
    snapshot: normalizeSnapshot(record.snapshot),
    ...(record.spendableAssets === undefined
      ? {}
      : { spendableAssets: Object.freeze(record.spendableAssets.map(normalizeSpendableAsset)) }),
    ...(record.baseFeeStroops === undefined ? {} : { baseFeeStroops: normalizeFee(record.baseFeeStroops) }),
  });
}

export function readCachedBalanceSnapshot(
  cache: Pick<BalanceCacheRepository, 'getSnapshot'>,
  partition: BalanceCachePartition,
): BalanceSnapshot | undefined {
  try {
    const record = cache.getSnapshot(partition);
    if (!record || record.snapshot.address !== partition.accountAddress) {
      return undefined;
    }
    return record.snapshot;
  } catch {
    return undefined;
  }
}

export function rememberBalanceSnapshot(
  cache: Pick<BalanceCacheRepository, 'getSnapshot' | 'replaceSnapshot'>,
  partition: BalanceCachePartition,
  snapshot: BalanceSnapshot,
  updatedAt: Date,
): void {
  if (snapshot.address !== partition.accountAddress) {
    return;
  }
  try {
    const previous = cache.getSnapshot(partition);
    const keepSpendable = previous?.snapshot.address === snapshot.address;
    cache.replaceSnapshot(partition, {
      schemaVersion: BALANCE_CACHE_SCHEMA_VERSION,
      updatedAt,
      snapshot,
      ...(keepSpendable && previous?.spendableAssets ? { spendableAssets: previous.spendableAssets } : {}),
      ...(keepSpendable && previous?.baseFeeStroops !== undefined ? { baseFeeStroops: previous.baseFeeStroops } : {}),
    });
  } catch {
    // A cache write must not turn a successful ledger read into a Home failure.
  }
}

export function rememberSpendableAssets(
  cache: Pick<BalanceCacheRepository, 'getSnapshot' | 'replaceSnapshot'>,
  partition: BalanceCachePartition,
  assets: readonly CachedSpendableAsset[],
  baseFeeStroops: number,
  updatedAt: Date,
): void {
  try {
    const previous = cache.getSnapshot(partition);
    const hiddenLiquidityPoolShareCount =
      previous?.snapshot.status === 'active' && previous.snapshot.address === partition.accountAddress
        ? previous.snapshot.hiddenLiquidityPoolShareCount
        : 0;
    cache.replaceSnapshot(partition, {
      schemaVersion: BALANCE_CACHE_SCHEMA_VERSION,
      updatedAt,
      snapshot: {
        status: 'active',
        address: partition.accountAddress,
        hiddenLiquidityPoolShareCount,
        balances: assets.map(asset => ({
          asset: asset.asset,
          balance: asset.balance,
        })),
      },
      spendableAssets: assets,
      baseFeeStroops,
    });
  } catch {
    // Keeping the previous asset list is safer than failing the Swap screen.
  }
}

function normalizeSpendableAsset(asset: CachedSpendableAsset): CachedSpendableAsset {
  if (!asset.balance || !asset.spendable || !asset.asset) {
    throw new Error('balance-cache-invalid-record');
  }
  return Object.freeze({
    asset: Object.freeze({ ...asset.asset }),
    balance: asset.balance,
    spendable: asset.spendable,
  });
}

function normalizeFee(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error('balance-cache-invalid-record');
  }
  return value;
}

function normalizeSnapshot(snapshot: BalanceSnapshot): BalanceSnapshot {
  if (!snapshot.address) {
    throw new Error('balance-cache-invalid-record');
  }
  if (snapshot.status === 'inactive' || snapshot.status === 'unsupported-account') {
    return Object.freeze({ status: snapshot.status, address: snapshot.address });
  }
  if (snapshot.status !== 'active' || !Array.isArray(snapshot.balances)) {
    throw new Error('balance-cache-invalid-record');
  }
  return Object.freeze({
    status: 'active',
    address: snapshot.address,
    hiddenLiquidityPoolShareCount: snapshot.hiddenLiquidityPoolShareCount,
    balances: Object.freeze(snapshot.balances.map(normalizeLine)),
  });
}

function isBalanceCachePayload(value: unknown): value is {
  snapshot: BalanceSnapshot;
  spendableAssets?: readonly CachedSpendableAsset[];
  baseFeeStroops?: number;
} {
  return (
    typeof value === 'object' &&
    value !== null &&
    'snapshot' in value &&
    isBalanceSnapshot((value as { snapshot: unknown }).snapshot)
  );
}

function isBalanceSnapshot(value: unknown): value is BalanceSnapshot {
  return typeof value === 'object' && value !== null && 'status' in value && 'address' in value;
}

function normalizeLine(line: BalanceLine): BalanceLine {
  if (!line.balance || !line.asset) {
    throw new Error('balance-cache-invalid-record');
  }
  return Object.freeze({
    ...line,
    asset: Object.freeze({ ...line.asset }),
  });
}
