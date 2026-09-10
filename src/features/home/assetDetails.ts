import type {BalanceAsset, BalanceLine, BalanceSnapshot} from '../../capabilities/balance/types';

export type AssetDetailsSnapshotState =
  | Readonly<{kind: 'ready'; line: BalanceLine}>
  | Readonly<{kind: 'inactive'}>
  | Readonly<{kind: 'unsupported-account'}>
  | Readonly<{kind: 'missing'}>;

export function resolveAssetDetailsSnapshot(
  snapshot: BalanceSnapshot,
  asset: BalanceAsset,
): AssetDetailsSnapshotState {
  if (snapshot.status === 'inactive') {
    return {kind: 'inactive'};
  }
  if (snapshot.status === 'unsupported-account') {
    return {kind: 'unsupported-account'};
  }

  const line = snapshot.balances.find(candidate => sameBalanceAsset(candidate.asset, asset));
  return line ? {kind: 'ready', line} : {kind: 'missing'};
}

export function sameBalanceAsset(left: BalanceAsset, right: BalanceAsset): boolean {
  if (left.kind !== right.kind) {
    return false;
  }
  if (left.kind === 'native' && right.kind === 'native') {
    return true;
  }
  return (
    left.kind === 'credit' &&
    right.kind === 'credit' &&
    left.code === right.code &&
    left.issuer === right.issuer
  );
}
