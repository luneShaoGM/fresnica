export type HistoryAsset =
  | Readonly<{kind: 'native'; code: 'XLM'}>
  | Readonly<{kind: 'credit'; code: string; issuer: string}>;

export type HistoryDirection = 'incoming' | 'outgoing' | 'self' | 'neutral';

export type HistoryEntryBase = Readonly<{
  id: string;
  pagingToken: string;
  operationType: string;
  occurredAt: string;
  transactionHash: string;
  sourceAccount: string;
}>;

export type HistoryPaymentEntry = HistoryEntryBase &
  Readonly<{
    kind: 'payment';
    direction: HistoryDirection;
    amount: string;
    asset: HistoryAsset;
    counterparty: string;
  }>;

export type HistoryCreateAccountEntry = HistoryEntryBase &
  Readonly<{
    kind: 'create-account';
    direction: HistoryDirection;
    startingBalance: string;
    counterparty: string;
  }>;

export type HistoryUnsupportedEntry = HistoryEntryBase &
  Readonly<{
    kind: 'unsupported';
    reason: 'operation-type' | 'operation-shape';
  }>;

export type HistoryEntry =
  | HistoryPaymentEntry
  | HistoryCreateAccountEntry
  | HistoryUnsupportedEntry;

export type HistoryPage =
  | Readonly<{
      status: 'active';
      entries: readonly HistoryEntry[];
      nextCursor?: string;
    }>
  | Readonly<{status: 'inactive'}>
  | Readonly<{status: 'unsupported-account'}>;
