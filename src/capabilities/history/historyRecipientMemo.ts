import { validateContactMemo } from '../contacts/contacts';
import type { StellarPaymentMemo } from '../stellar/types';

export type HistoryRecipientMemo = Readonly<{ recipient: string; memo: StellarPaymentMemo }>;

// Display context only; never a destination/memo prefill or signing authority.
export function normalizeHistoryRecipientMemo(value: unknown): HistoryRecipientMemo | undefined {
  if (value === undefined) return undefined;
  if (
    !value ||
    typeof value !== 'object' ||
    !('recipient' in value) ||
    typeof value.recipient !== 'string' ||
    !/^(?:G[A-Z2-7]{55}|M[A-Z2-7]{68})$/.test(value.recipient) ||
    !('memo' in value)
  )
    throw new Error('history-memo-invalid');
  const memo = validateContactMemo(value.memo);
  if (!memo) throw new Error('history-memo-invalid');
  return Object.freeze({ recipient: value.recipient, memo });
}
