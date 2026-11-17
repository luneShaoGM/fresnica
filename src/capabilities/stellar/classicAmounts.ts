import type { StellarAccountState, StellarLedgerParameters, StellarPaymentAsset } from './types';

export const MAX_STROOPS = 9_223_372_036_854_775_807n;
export function stroops(value: string): bigint {
  if (typeof value !== 'string' || value.length > 24 || !/^(0|[1-9]\d*)(\.\d{1,7})?$/.test(value))
    throw new Error('invalid_request');
  const [whole, fraction = ''] = value.split('.');
  const result = BigInt(whole) * 10_000_000n + BigInt(fraction.padEnd(7, '0'));
  if (result > MAX_STROOPS) throw new Error('invalid_request');
  return result;
}
export function amount(value: bigint): string {
  if (value < 0n || value > MAX_STROOPS) throw new Error('invalid_request');
  return `${value / 10_000_000n}.${String(value % 10_000_000n).padStart(7, '0')}`;
}
export function assetKey(asset: StellarPaymentAsset): string {
  return asset.kind === 'native' ? 'XLM' : `${asset.code}:${asset.issuer}`;
}
export function lineFor(account: StellarAccountState, asset: StellarPaymentAsset) {
  return account.balances.find(line =>
    asset.kind === 'native'
      ? line.kind === 'native'
      : line.kind === 'credit' && line.code === asset.code && line.issuer === asset.issuer,
  );
}
export function receivingCapacity(account: StellarAccountState, asset: StellarPaymentAsset): bigint {
  if (asset.kind === 'credit' && asset.issuer === account.address) return MAX_STROOPS;
  const line = lineFor(account, asset);
  if (!line || line.kind === 'liquidity-pool-share') throw new Error('receiving_trustline_missing');
  const limit = line.kind === 'native' ? MAX_STROOPS : stroops(line.limit ?? '0');
  const capacity = limit - stroops(line.balance) - stroops(line.buyingLiabilities ?? '0');
  return capacity > 0n ? capacity : 0n;
}
export function nativeAvailable(account: StellarAccountState, ledger: StellarLedgerParameters, fee: bigint): bigint {
  if (
    [
      ledger.baseFeeStroops,
      ledger.baseReserveStroops,
      account.subentryCount,
      account.numSponsored,
      account.numSponsoring,
    ].some(n => !Number.isSafeInteger(n) || n < 0) ||
    ledger.baseFeeStroops < 1
  )
    throw new Error('invalid_request');
  const native = account.balances.find(line => line.kind === 'native');
  if (!native || native.kind !== 'native') throw new Error('insufficient_fee');
  const units = 2n + BigInt(account.subentryCount) + BigInt(account.numSponsoring) - BigInt(account.numSponsored);
  const reserve = (units > 0n ? units : 0n) * BigInt(ledger.baseReserveStroops);
  const available = stroops(native.balance) - stroops(native.sellingLiabilities) - reserve - fee;
  if (available < 0n) throw new Error('insufficient_fee');
  return available;
}
