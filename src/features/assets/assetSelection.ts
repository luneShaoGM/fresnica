import type { BalanceAsset, BalanceLine } from '../../capabilities/balance/types';

export function assetSelectionKey(asset: BalanceAsset): string {
  return asset.kind === 'native' ? 'native' : `${asset.code}:${asset.issuer}`;
}

export function matchesAssetSearch(asset: BalanceAsset, query: string): boolean {
  const text = query.trim().toLowerCase();
  return `${asset.code} ${asset.kind === 'credit' ? asset.issuer : ''}`.toLowerCase().includes(text);
}

export function sendSelectableBalances(balances: readonly BalanceLine[]): readonly BalanceLine[] {
  return balances.filter(line => line.asset.kind === 'native' || Number(line.balance) > 0);
}
