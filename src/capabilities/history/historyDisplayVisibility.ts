import { isPathAmount } from './pathPaymentHistory';
import type { HistoryEntry } from './types';

// Reversible display policy, never a risk assessment or a change to ledger data.
export function isNormallyHiddenHistory(entry: HistoryEntry, accountAddress: string): boolean {
  if (entry.kind === 'failed' || entry.kind === 'unsupported') return false;
  if (
    [
      'manage_data',
      'bump_sequence',
      'begin_sponsoring_future_reserves',
      'end_sponsoring_future_reserves',
      'revoke_sponsorship',
      'extend_footprint_ttl',
      'restore_footprint',
    ].includes(entry.operationType)
  )
    return true;
  if (entry.kind === 'trust-authorization' || entry.kind === 'trust-flags') {
    return entry.sourceAccount !== accountAddress && entry.trustor !== accountAddress;
  }
  return false;
}

export function isDustHistory(entry: HistoryEntry): boolean {
  if (entry.successful !== true || (entry.kind !== 'payment' && entry.kind !== 'path-payment')) return false;
  // Only actual incoming/self destination legs are known receipts; failed attempts have no applied money.
  if (entry.direction !== 'incoming' && entry.direction !== 'self') return false;
  const asset = entry.kind === 'payment' ? entry.asset : entry.destinationAsset;
  const amount = entry.kind === 'payment' ? entry.amount : entry.destinationAmount;
  if (asset.kind !== 'native' || !isPathAmount(amount)) return false;
  const [whole, fraction = ''] = amount.split('.');
  return BigInt(whole) * 10_000_000n + BigInt(fraction.padEnd(7, '0')) <= 1_000_000n;
}
