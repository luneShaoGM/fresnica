import type { HistoryOperationAsset, HistoryOperationRecord } from './HistoryGateway';
import type { HistoryAsset, HistoryEntryBase, HistoryParticipant, HistoryPathPaymentEntry } from './types';

export function isPathPaymentType(type: string): boolean {
  return type === 'path_payment_strict_send' || type === 'path_payment_strict_receive';
}

export function mapPathPayment(
  record: HistoryOperationRecord,
  accountAddress: string,
  base: HistoryEntryBase,
): HistoryPathPaymentEntry | undefined {
  const sender = endpoint('sender', record.from, record.fromMuxed);
  const recipient = endpoint('recipient', record.to, record.toMuxed);
  const sourceAsset = pathAsset(record.sourceAsset);
  const destinationAsset = pathAsset(record.asset);
  if (
    !isPathPaymentType(record.type) ||
    record.successful !== true ||
    !sender ||
    !recipient ||
    record.from !== base.sourceAccount ||
    !sourceAsset ||
    !destinationAsset ||
    !isPathAmount(record.sourceAmount) ||
    !isPathAmount(record.amount)
  )
    return undefined;
  const fromSelf = record.from === accountAddress;
  const toSelf = record.to === accountAddress;
  return Object.freeze({
    ...base,
    kind: 'path-payment',
    successful: true,
    direction: fromSelf ? (toSelf ? 'self' : 'outgoing') : toSelf ? 'incoming' : 'neutral',
    sourceAmount: record.sourceAmount,
    sourceAsset,
    destinationAmount: record.amount,
    destinationAsset,
    counterparty: fromSelf ? recipient.identity : sender.identity,
    participants: Object.freeze([sender, recipient]) as readonly [HistoryParticipant, HistoryParticipant],
  });
}

export function isPathSwap(entry: HistoryPathPaymentEntry): boolean {
  return entry.direction === 'self' && !sameAsset(entry.sourceAsset, entry.destinationAsset);
}

function sameAsset(left: HistoryAsset, right: HistoryAsset): boolean {
  return (
    left.kind === right.kind &&
    left.code === right.code &&
    (left.kind === 'native' || (right.kind === 'credit' && left.issuer === right.issuer))
  );
}

export function isPathAmount(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d+(?:\.\d{1,7})?$/.test(value)) return false;
  const [whole, fraction = ''] = value.split('.');
  const significantWhole = whole.replace(/^0+/, '') || '0';
  if (significantWhole.length > 12) return false;
  const stroops = BigInt(significantWhole) * 10_000_000n + BigInt(fraction.padEnd(7, '0'));
  return stroops > 0n && stroops <= 9_223_372_036_854_775_807n;
}

function classic(value: unknown): value is string {
  return typeof value === 'string' && /^G[A-Z2-7]{55}$/.test(value);
}

function endpoint(role: 'sender' | 'recipient', base: unknown, muxed: unknown): HistoryParticipant | undefined {
  if (!classic(base)) return undefined;
  if (muxed !== undefined && (typeof muxed !== 'string' || !/^M[A-Z2-7]{68}$/.test(muxed))) return undefined;
  return Object.freeze({
    role,
    identity: muxed === undefined ? base : muxed,
    ...(muxed === undefined ? {} : { baseAccount: base }),
  });
}

function pathAsset(asset: HistoryOperationAsset | undefined): HistoryAsset | undefined {
  if (asset?.kind === 'native') return Object.freeze({ kind: 'native', code: 'XLM' });
  if (
    asset?.kind === 'credit' &&
    typeof asset.code === 'string' &&
    /^[a-zA-Z0-9]{1,12}$/.test(asset.code) &&
    classic(asset.issuer)
  )
    return Object.freeze({ kind: 'credit', code: asset.code, issuer: asset.issuer });
  return undefined;
}
