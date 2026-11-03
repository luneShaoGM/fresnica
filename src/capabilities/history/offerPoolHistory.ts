import type { HistoryOperationRecord } from './HistoryGateway';
import { isPathAmount, pathAsset, sameAsset } from './pathPaymentHistory';
import type { HistoryEntryBase, HistoryOfferEntry, HistoryPoolEntry } from './types';

export function isOfferType(type: string): boolean {
  return type === 'manage_buy_offer' || type === 'manage_sell_offer' || type === 'create_passive_sell_offer';
}
export function isPoolType(type: string): boolean {
  return type === 'liquidity_pool_deposit' || type === 'liquidity_pool_withdraw';
}
export function mapOfferPool(
  record: HistoryOperationRecord,
  accountAddress: string,
  base: HistoryEntryBase,
): HistoryOfferEntry | HistoryPoolEntry | undefined {
  if (
    record.successful !== true ||
    record.sourceAccount !== base.sourceAccount ||
    !/^G[A-Z2-7]{55}$/.test(base.sourceAccount) ||
    base.sourceAccount !== accountAddress
  )
    return undefined;
  if (isOfferType(record.type)) {
    const buyingAsset = pathAsset(record.buyingAsset);
    const sellingAsset = pathAsset(record.sellingAsset);
    const passive = record.type === 'create_passive_sell_offer';
    if (
      !buyingAsset ||
      !sellingAsset ||
      sameAsset(buyingAsset, sellingAsset) ||
      !isPathAmount(record.amount, !passive) ||
      !rational(record.price?.n) ||
      !rational(record.price?.d) ||
      (!passive && !offerId(record.offerId)) ||
      (record.offerId !== undefined && !offerId(record.offerId))
    )
      return undefined;
    return Object.freeze({
      ...base,
      kind: 'offer',
      successful: true,
      buyingAsset,
      sellingAsset,
      amount: record.amount,
      price: Object.freeze({ n: record.price.n, d: record.price.d }),
      ...(record.offerId === undefined ? {} : { offerId: record.offerId }),
      cancellation: /^0+(?:\.0+)?$/.test(record.amount),
    });
  }
  if (isPoolType(record.type)) {
    if (
      typeof record.poolId !== 'string' ||
      !/^[a-f0-9]{64}$/.test(record.poolId) ||
      !Array.isArray(record.reserves) ||
      record.reserves.length !== 2 ||
      !isPathAmount(record.shares)
    )
      return undefined;
    const legs = record.reserves.map(leg => {
      const asset = pathAsset(leg?.asset);
      return asset && isPathAmount(leg?.amount, true) ? Object.freeze({ asset, amount: leg.amount }) : undefined;
    });
    const [first, second] = legs;
    if (
      !first ||
      !second ||
      sameAsset(first.asset, second.asset) ||
      (!isPathAmount(first.amount) && !isPathAmount(second.amount))
    )
      return undefined;
    return Object.freeze({
      ...base,
      kind: 'liquidity-pool',
      successful: true,
      poolId: record.poolId,
      reserves: Object.freeze([first, second]) as HistoryPoolEntry['reserves'],
      shares: record.shares,
    });
  }
  return undefined;
}
function rational(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 2_147_483_647;
}
function offerId(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return false;
  const significant = value.replace(/^0+/, '') || '0';
  return significant.length <= 19 && BigInt(significant) <= 9_223_372_036_854_775_807n;
}
