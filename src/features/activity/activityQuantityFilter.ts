import { isPathAmount } from '@capabilities/history/pathPaymentHistory';
import type { HistoryAsset, HistoryEntry } from '@capabilities/history/types';
import { activityAssetIdentity } from './activityRowPresentation';
import { entryAssetIdentities } from './activityAssetVisibility';

export type ActivityQuantityFilter = Readonly<{
  direction?: 'incoming' | 'outgoing';
  asset?: string;
  comparison?: 'at-most' | 'at-least';
  amount?: string;
}>;
type Leg = Readonly<{ asset: HistoryAsset; amount: string; direction?: 'incoming' | 'outgoing' }>;
export function activityQuantityLegs(entry: HistoryEntry): readonly Leg[] {
  if (entry.successful !== true) return [];
  switch (entry.kind) {
    case 'payment':
    case 'create-account': {
      const asset: HistoryAsset = entry.kind === 'payment' ? entry.asset : { kind: 'native', code: 'XLM' };
      const amount = entry.kind === 'payment' ? entry.amount : entry.startingBalance;
      return [
        {
          asset,
          amount,
          ...(entry.direction === 'incoming' || entry.direction === 'outgoing' ? { direction: entry.direction } : {}),
        },
      ];
    }
    case 'path-payment':
      return [
        ...(entry.direction === 'outgoing' || entry.direction === 'self'
          ? [{ asset: entry.sourceAsset, amount: entry.sourceAmount, direction: 'outgoing' as const }]
          : []),
        ...(entry.direction === 'incoming' || entry.direction === 'self'
          ? [{ asset: entry.destinationAsset, amount: entry.destinationAmount, direction: 'incoming' as const }]
          : []),
      ];
    case 'liquidity-pool':
      return entry.reserves.map(leg => ({
        ...leg,
        direction: entry.operationType === 'liquidity_pool_deposit' ? 'outgoing' : 'incoming',
      }));
    case 'claimable-create':
      return entry.role === 'funder' ? [{ asset: entry.asset, amount: entry.amount, direction: 'outgoing' }] : [];
    case 'claimable-reference':
      return entry.asset && entry.amount
        ? [
            {
              asset: entry.asset,
              amount: entry.amount,
              ...(entry.operationType === 'claim_claimable_balance' ? { direction: 'incoming' as const } : {}),
            },
          ]
        : [];
    case 'clawback':
      return [
        {
          asset: entry.asset,
          amount: entry.amount,
          ...(entry.role === 'holder' ? { direction: 'outgoing' as const } : {}),
        },
      ];
    case 'contract':
      return (entry.events ?? [])
        .filter(event => event.direction !== 'neutral')
        .map(event => ({
          asset: event.asset,
          amount: event.amount,
          ...(event.direction === 'incoming' || event.direction === 'outgoing' ? { direction: event.direction } : {}),
        }));
    default:
      return [];
  }
}
function integerAmount(value: string): bigint {
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 10_000_000n + BigInt(fraction.padEnd(7, '0'));
}
export function matchesActivityQuantity(entry: HistoryEntry, filter: ActivityQuantityFilter): boolean {
  const amountActive = filter.comparison !== undefined && filter.amount !== undefined;
  if (!filter.direction && !amountActive) return !filter.asset || entryAssetIdentities(entry).includes(filter.asset);
  if (amountActive && !isPathAmount(filter.amount)) return false;
  return activityQuantityLegs(entry).some(leg => {
    if (filter.direction && leg.direction !== filter.direction) return false;
    if (filter.asset && activityAssetIdentity(leg.asset) !== filter.asset) return false;
    if (!isPathAmount(leg.amount)) return false;
    if (!amountActive) return true;
    const actual = integerAmount(leg.amount);
    const limit = integerAmount(filter.amount!);
    return filter.comparison === 'at-most' ? actual <= limit : actual >= limit;
  });
}
