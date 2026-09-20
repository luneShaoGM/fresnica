export type HistoryCreditAsset = Readonly<{kind: 'credit'; code: string; issuer: string}>;

export type HistoryAsset =
  | Readonly<{kind: 'native'; code: 'XLM'}>
  | HistoryCreditAsset;

export type HistoryDirection = 'incoming' | 'outgoing' | 'self' | 'neutral';

export type HistoryParticipantRole =
  | 'sender'
  | 'recipient'
  | 'funder'
  | 'created-account'
  | 'trustor'
  | 'issuer';

export type HistoryParticipant = Readonly<{
  role: HistoryParticipantRole;
  identity: string;
  baseAccount?: string;
}>;

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
    participants: readonly [HistoryParticipant, HistoryParticipant];
  }>;

export type HistoryCreateAccountEntry = HistoryEntryBase &
  Readonly<{
    kind: 'create-account';
    direction: HistoryDirection;
    startingBalance: string;
    counterparty: string;
    participants: readonly [HistoryParticipant, HistoryParticipant];
  }>;

export type HistoryChangeTrustEntry = HistoryEntryBase &
  Readonly<{
    kind: 'change-trust';
    asset: HistoryCreditAsset;
    limit: string;
    participants: readonly [HistoryParticipant, HistoryParticipant];
  }>;

export type HistoryUnsupportedEntry = HistoryEntryBase &
  Readonly<{
    kind: 'unsupported';
    reason: 'operation-type' | 'operation-shape';
  }>;

export type HistoryEntry =
  | HistoryPaymentEntry
  | HistoryCreateAccountEntry
  | HistoryChangeTrustEntry
  | HistoryUnsupportedEntry;

export type HistoryPage =
  | Readonly<{
      status: 'active';
      entries: readonly HistoryEntry[];
      nextCursor?: string;
    }>
  | Readonly<{status: 'inactive'}>
  | Readonly<{status: 'unsupported-account'}>;
