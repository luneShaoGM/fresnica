import {
  normalizeHistoryRecipientMemo,
  type HistoryRecipientMemo,
} from '../../capabilities/history/historyRecipientMemo';
import type { HorizonOperationLike } from './types';

export function historyJoinedMemo(operation: HorizonOperationLike): HistoryRecipientMemo | undefined {
  if (
    !['payment', 'path_payment_strict_send', 'path_payment_strict_receive', 'create_account', 'account_merge'].includes(
      operation.type,
    )
  )
    return undefined;
  const transaction = operation.transaction_attr;
  if (
    !transaction ||
    typeof transaction !== 'object' ||
    !('hash' in transaction) ||
    transaction.hash !== operation.transaction_hash ||
    !('memo_type' in transaction) ||
    !('memo' in transaction) ||
    typeof transaction.memo !== 'string'
  )
    return undefined;
  const type = transaction.memo_type;
  if (type !== 'text' && type !== 'id' && type !== 'hash' && type !== 'return') return undefined;
  try {
    const value = type === 'hash' || type === 'return' ? hashMemoHex(transaction.memo) : transaction.memo;
    const recipient =
      operation.to_muxed ??
      operation.to ??
      (operation.type === 'create_account'
        ? operation.account
        : operation.type === 'account_merge'
          ? operation.into
          : undefined);
    return normalizeHistoryRecipientMemo({ recipient, memo: { type, value } });
  } catch {
    return undefined;
  }
}
function hashMemoHex(value: string): string {
  if (!/^[A-Za-z0-9+/]{43}=$/.test(value)) throw new Error('invalid-hash-memo');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes: number[] = [];
  let block = 0;
  let bits = 0;
  for (const char of value.slice(0, -1)) {
    block = block * 64 + alphabet.indexOf(char);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push(Math.floor(block / 2 ** bits));
      block %= 2 ** bits;
    }
  }
  if (bytes.length !== 32 || block !== 0) throw new Error('invalid-hash-memo');
  return bytes.map(byte => byte.toString(16).padStart(2, '0')).join('');
}
