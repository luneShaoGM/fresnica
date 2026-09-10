export type HistoryOperationAsset = Readonly<
  | { kind: 'native' }
  | { kind: 'credit'; code?: string; issuer?: string }
  | { kind: 'unsupported' }
>;

export type HistoryOperationRecord = Readonly<{
  id: string;
  pagingToken: string;
  type: string;
  occurredAt: string;
  transactionHash: string;
  sourceAccount: string;
  from?: string;
  to?: string;
  toMuxed?: string;
  amount?: string;
  asset?: HistoryOperationAsset;
  funder?: string;
  account?: string;
  startingBalance?: string;
}>;

export type HistoryOperationLookupResult =
  | Readonly<{status: 'found'; record: HistoryOperationRecord}>
  | Readonly<{status: 'not-found'}>;

export type HistoryOperationResult =
  | Readonly<{
      status: 'active';
      address: string;
      records: readonly HistoryOperationRecord[];
      nextCursor?: string;
    }>
  | Readonly<{ status: 'inactive'; address: string }>;

export interface HistoryGatewayPort {
  loadOperation(input: Readonly<{operationId: string}>): Promise<HistoryOperationLookupResult>;
  loadAccountOperations(
    input: Readonly<{
      address: string;
      cursor?: string;
      limit: number;
    }>,
  ): Promise<HistoryOperationResult>;
}
