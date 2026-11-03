export type HistoryCreditAsset = Readonly<{ kind: 'credit'; code: string; issuer: string }>;

export type HistoryAsset = Readonly<{ kind: 'native'; code: 'XLM' }> | HistoryCreditAsset;

export type HistoryDirection = 'incoming' | 'outgoing' | 'self' | 'neutral';

export type HistoryParticipantRole = 'sender' | 'recipient' | 'funder' | 'created-account' | 'trustor' | 'issuer';

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

export type HistoryPathPaymentEntry = HistoryEntryBase &
  Readonly<{
    kind: 'path-payment';
    successful: true;
    direction: HistoryDirection;
    sourceAmount: string;
    sourceAsset: HistoryAsset;
    destinationAmount: string;
    destinationAsset: HistoryAsset;
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

export type HistoryOfferEntry = HistoryEntryBase &
  Readonly<{
    kind: 'offer';
    successful: true;
    buyingAsset: HistoryAsset;
    sellingAsset: HistoryAsset;
    amount: string;
    price: Readonly<{ n: number; d: number }>;
    offerId?: string;
    cancellation: boolean;
  }>;

export type HistoryPoolEntry = HistoryEntryBase &
  Readonly<{
    kind: 'liquidity-pool';
    successful: true;
    poolId: string;
    reserves: readonly [
      Readonly<{ asset: HistoryAsset; amount: string }>,
      Readonly<{ asset: HistoryAsset; amount: string }>,
    ];
    shares: string;
  }>;

export type HistoryClaimPredicate = Readonly<
  | { unconditional: true }
  | { and: readonly [HistoryClaimPredicate, HistoryClaimPredicate] }
  | { or: readonly [HistoryClaimPredicate, HistoryClaimPredicate] }
  | { not: HistoryClaimPredicate }
  | { abs_before: string; abs_before_epoch?: string }
  | { abs_before_epoch: string }
  | { rel_before: string }
>;
export type HistoryClaimant = Readonly<{ destination: string; predicate: HistoryClaimPredicate }>;
export type HistoryClaimableEntry = HistoryEntryBase &
  Readonly<{
    kind: 'claimable-create';
    successful: true;
    asset: HistoryAsset;
    amount: string;
    claimants: readonly HistoryClaimant[];
    role: 'funder' | 'issuer' | 'claimant';
  }>;
export type HistoryBalanceReferenceEntry = HistoryEntryBase &
  Readonly<{
    kind: 'claimable-reference';
    successful: true;
    balanceId: string;
  }>;
export type HistoryClawbackEntry = HistoryEntryBase &
  Readonly<{
    kind: 'clawback';
    successful: true;
    asset: HistoryCreditAsset;
    amount: string;
    holder: string;
    holderBase: string;
    role: 'issuer' | 'holder';
  }>;
export type HistoryEntry =
  | HistoryClaimableEntry
  | HistoryBalanceReferenceEntry
  | HistoryClawbackEntry
  | HistoryOfferEntry
  | HistoryPoolEntry
  | HistoryPathPaymentEntry
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
  | Readonly<{ status: 'inactive' }>
  | Readonly<{ status: 'unsupported-account' }>;
