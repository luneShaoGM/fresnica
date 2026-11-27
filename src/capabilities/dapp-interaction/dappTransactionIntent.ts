export type DappPaymentIntent = Readonly<{
  type: 'payment';
  source: string;
  destination: string;
  amount: string;
  assetCode: string;
  assetIssuer?: string;
}>;

export type DappSorobanIntent = Readonly<{
  type: 'soroban-transfer' | 'soroban-supply-collateral';
  contract: string;
  destination: string;
  amount: string;
  assetCode: 'XLM';
  assetIssuer?: never;
}>;

export type DappOperationIntent =
  | DappPaymentIntent
  | DappSorobanIntent
  | Readonly<{ type: 'create-account'; destination: string; amount: string; assetCode: 'XLM'; assetIssuer?: never }>
  | Readonly<{ type: 'change-trust'; assetCode: string; assetIssuer: string; limit: string }>;

export type DappTransactionIntent = Readonly<{
  hash: string;
  source: string;
  sequence: string;
  fee: string;
  memo: string | null;
  timeBounds?: Readonly<{ minTime: string; maxTime: string }>;
  operations: readonly DappOperationIntent[];
}>;
