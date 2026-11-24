import type { BalanceAsset, BalanceLine } from '../../capabilities/balance/types';
import {
  projectCreditBalanceAvailability,
  type CreditSendBlockedReason,
} from '../../capabilities/balance/creditBalanceAvailability';

export function assetSelectionKey(asset: BalanceAsset): string {
  return asset.kind === 'native' ? 'native' : `${asset.code}:${asset.issuer}`;
}

export function matchesAssetSearch(asset: BalanceAsset, query: string): boolean {
  const text = query.trim().toLowerCase();
  return `${asset.code} ${asset.kind === 'credit' ? asset.issuer : ''}`.toLowerCase().includes(text);
}

export function sendSelectableBalances(balances: readonly BalanceLine[]): readonly BalanceLine[] {
  // Keep positive-balance restricted rows visible so the picker can explain why
  // they cannot be selected. Zero-balance trustlines remain Swap-only candidates.
  return balances.filter(line => {
    if (line.asset.kind === 'native') return true;
    const balance = projectCreditBalanceAvailability(line).balance;
    return balance !== undefined && balance !== '0.0000000';
  });
}

export function sendAssetAvailability(line: BalanceLine | undefined): Readonly<{
  available?: string;
  blockedReason?: CreditSendBlockedReason;
}> {
  if (!line) return { blockedReason: 'unknown' };
  // Native reserve/fee preparation is unchanged by this credit-asset projection.
  if (line.asset.kind === 'native') return { available: line.balance };
  const credit = projectCreditBalanceAvailability(line);
  return { available: credit.available, blockedReason: credit.sendBlockedReason };
}
