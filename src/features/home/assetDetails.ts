import type { CachedSpendableAsset } from '../../capabilities/balance/BalanceCacheRepository';
import type { BalanceAsset, BalanceLine, BalanceSnapshot } from '../../capabilities/balance/types';

export type AssetDetailsSnapshotState =
  | Readonly<{ kind: 'ready'; line: BalanceLine }>
  | Readonly<{ kind: 'inactive' }>
  | Readonly<{ kind: 'unsupported-account' }>
  | Readonly<{ kind: 'missing' }>;

export function resolveAssetDetailsSnapshot(snapshot: BalanceSnapshot, asset: BalanceAsset): AssetDetailsSnapshotState {
  if (snapshot.status === 'inactive') {
    return { kind: 'inactive' };
  }
  if (snapshot.status === 'unsupported-account') {
    return { kind: 'unsupported-account' };
  }

  const line = snapshot.balances.find(candidate => sameBalanceAsset(candidate.asset, asset));
  return line ? { kind: 'ready', line } : { kind: 'missing' };
}

const REMOVE_BELOW = 0.0001;
const SEND_AT_LEAST = 0.00000001;

export function canRemoveIssuedBalance(balance: string): boolean {
  const value = Number(balance);
  return Number.isFinite(value) && value >= 0 && value < REMOVE_BELOW;
}

export function canSendBalance(balance: string): boolean {
  const value = Number(balance);
  return Number.isFinite(value) && value >= SEND_AT_LEAST;
}

export function authoritativeSpendable(
  assets: readonly CachedSpendableAsset[] | undefined,
  baseFeeStroops: number | undefined,
  asset: BalanceAsset,
): string | undefined {
  if (!assets || baseFeeStroops === undefined) return undefined;
  return assets.find(item => sameBalanceAsset(item.asset, asset))?.spendable;
}

export function sameBalanceAsset(left: BalanceAsset, right: BalanceAsset): boolean {
  if (left.kind !== right.kind) {
    return false;
  }
  if (left.kind === 'native' && right.kind === 'native') {
    return true;
  }
  return left.kind === 'credit' && right.kind === 'credit' && left.code === right.code && left.issuer === right.issuer;
}
