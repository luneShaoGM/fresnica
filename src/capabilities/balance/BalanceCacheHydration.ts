import type { AccountRecord } from '../account/types';
import type { BalanceDependencies } from './loadBalanceSnapshot';
import {
  BALANCE_CACHE_SCHEMA_VERSION,
  normalizeBalanceCacheSnapshot,
  type BalanceCacheRepository,
  type BalanceCachePartition,
  type BalanceCacheSnapshot,
} from './BalanceCacheRepository';
import type { BalanceSnapshot } from './types';

export type BalanceProductDependencies = BalanceDependencies &
  Readonly<{ cache: BalanceCacheRepository; now: () => Date }>;
function partitionFor(
  dependencies: Pick<BalanceProductDependencies, 'networkId'>,
  account: AccountRecord,
): BalanceCachePartition | undefined {
  if (dependencies.networkId !== account.networkId) throw new Error('balance-network-mismatch');
  return account.identityKind === 'classic'
    ? { networkId: account.networkId, accountAddress: account.address }
    : undefined;
}
export function readBalanceCacheBestEffort(
  dependencies: BalanceProductDependencies,
  account: AccountRecord,
): BalanceCacheSnapshot | undefined {
  const partition = partitionFor(dependencies, account);
  if (!partition) return undefined;
  try {
    return dependencies.cache.getSnapshot(partition);
  } catch {
    return undefined;
  }
}
export function cacheBalanceSnapshotBestEffort(
  dependencies: BalanceProductDependencies,
  account: AccountRecord,
  balance: BalanceSnapshot,
  updatedAt: Date,
): boolean {
  const partition = partitionFor(dependencies, account);
  if (!partition || balance.status === 'unsupported-account') return false;
  try {
    dependencies.cache.replaceSnapshot(
      partition,
      normalizeBalanceCacheSnapshot(partition, {
        schemaVersion: BALANCE_CACHE_SCHEMA_VERSION,
        lastSuccessfulUpdateAt: updatedAt,
        balance,
      }),
    );
    return true;
  } catch {
    return false;
  }
}
