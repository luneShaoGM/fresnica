export type HistoryOperationAsset = Readonly<
  { kind: 'native' } | { kind: 'credit'; code?: string; issuer?: string } | { kind: 'unsupported' }
>;

export type HistoryOperationRecord = Readonly<{
  id: string;
  pagingToken: string;
  type: string;
  occurredAt: string;
  transactionHash: string;
  sourceAccount: string;
  successful?: boolean;
  outcomeUnknown?: true;
  authorize?: unknown;
  authorizeToMaintainLiabilities?: unknown;
  setFlags?: unknown;
  clearFlags?: unknown;
  sponsoredId?: unknown;
  beginSponsor?: unknown;
  extendTo?: unknown;
  bumpTo?: unknown;
  dataName?: unknown;
  controlParameters?: unknown;
  hostFunction?: unknown;
  contractId?: unknown;
  creationOrigin?: unknown;
  deployer?: unknown;
  creationAsset?: HistoryOperationAsset;
  functionName?: unknown;
  assetBalanceChanges?: unknown;
  claimants?: unknown;
  claimant?: string;
  balanceId?: string;
  buyingAsset?: HistoryOperationAsset;
  sellingAsset?: HistoryOperationAsset;
  offerId?: string;
  price?: Readonly<{ n: number; d: number }>;
  poolId?: string;
  reserves?: readonly Readonly<{ asset: HistoryOperationAsset; amount: string }>[];
  shares?: string;
  sourceAmount?: string;
  sourceAsset?: HistoryOperationAsset;
  fromMuxed?: string;
  from?: string;
  to?: string;
  toMuxed?: string;
  amount?: string;
  asset?: HistoryOperationAsset;
  funder?: string;
  account?: string;
  startingBalance?: string;
  trustor?: string;
  trustee?: string;
  limit?: string;
}>;

export type HistoryOperationLookupResult =
  Readonly<{ status: 'found'; record: HistoryOperationRecord }> | Readonly<{ status: 'not-found' }>;

export type HistoryOperationResult =
  | Readonly<{
      status: 'active';
      address: string;
      records: readonly HistoryOperationRecord[];
      nextCursor?: string;
    }>
  | Readonly<{ status: 'inactive'; address: string }>;

export interface HistoryGatewayPort {
  loadOperation(
    input: Readonly<{ operationId: string; accountAddress: string }>,
  ): Promise<HistoryOperationLookupResult>;
  loadAccountOperations(
    input: Readonly<{
      address: string;
      cursor?: string;
      limit: number;
    }>,
  ): Promise<HistoryOperationResult>;
}
