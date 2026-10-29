export type DappPaymentIntent = Readonly<{
  type: 'payment';
  source: string;
  destination: string;
  amount: string;
  assetCode: string;
  assetIssuer?: string;
}>;

export type DappTransactionIntent = Readonly<{
  hash: string;
  source: string;
  sequence: string;
  fee: string;
  memo: string | null;
  timeBounds?: Readonly<{ minTime: string; maxTime: string }>;
  operations: readonly DappPaymentIntent[];
}>;
