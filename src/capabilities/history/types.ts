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
  successful?: boolean;
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
export type HistoryEffectEvidence = Readonly<{ operationId: string; complete: true; records: readonly Readonly<{type: string; account: string; balanceId?: string; asset?: HistoryAsset; amount?: string }>[] }>;
export type HistoryBalanceReferenceEntry = HistoryEntryBase &
  Readonly<{
    kind: 'claimable-reference';
    asset?: HistoryAsset;
    amount?: string;
    evidence?: HistoryEffectEvidence;
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
export type HistoryContractEvent = Readonly<{
  type: 'transfer' | 'mint' | 'burn' | 'clawback';
  asset: HistoryAsset;
  amount: string;
  from?: string;
  to?: string;
  destinationMuxedId?: string;
  direction: HistoryDirection;
}>;
export type HistoryContractEntry = HistoryEntryBase &
  Readonly<{
    kind: 'contract';
    successful: true;
    hostFunction: 'invoke' | 'create' | 'create-v2' | 'upload';
    creationOrigin?: 'address' | 'asset';
    deployer?: string;
    creationAsset?: HistoryAsset;
    contractId?: string;
    functionName?: string;
    events?: readonly HistoryContractEvent[];
  }>;
export type HistoryMaintenanceEntry = HistoryEntryBase &
  Readonly<{
    kind: 'maintenance';
    successful: true;
    extendTo?: number;
    bumpTo?: string;
    dataName?: string;
  }>;
export type HistoryTrustFlag = 1 | 2 | 4;
export type HistoryTrustAuthorizationEntry = HistoryEntryBase &
  Readonly<{
    kind: 'trust-authorization';
    successful: true;
    asset: HistoryCreditAsset;
    trustor: string;
    authorization: 'authorized' | 'maintain-liabilities' | 'revoked';
  }>;
export type HistoryTrustFlagsEntry = HistoryEntryBase &
  Readonly<{
    kind: 'trust-flags';
    successful: true;
    asset: HistoryCreditAsset;
    trustor: string;
    setFlags: readonly HistoryTrustFlag[];
    clearFlags: readonly HistoryTrustFlag[];
  }>;
export type HistorySponsorshipEntry = HistoryEntryBase &
  Readonly<{
    kind: 'sponsorship';
    successful: true;
    sponsor: string;
    beneficiary: string;
    role: 'sponsor' | 'beneficiary';
  }>;
export type HistoryControlParameters = Readonly<Record<string, string | number | readonly number[]>>;
export type HistoryControlEntry = HistoryEntryBase & Readonly<{
  kind: 'account-control'; successful: true; parameters: HistoryControlParameters; counterparty?: string;
}>;
export type HistoryFailedEntry = HistoryEntryBase & Readonly<{ kind: 'failed'; successful: false; relatedAccounts: readonly string[] }>;
export type HistoryEntry =
  | HistoryFailedEntry
  | HistoryControlEntry
  | HistoryTrustAuthorizationEntry
  | HistoryTrustFlagsEntry
  | HistorySponsorshipEntry
  | HistoryMaintenanceEntry
  | HistoryContractEntry
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
