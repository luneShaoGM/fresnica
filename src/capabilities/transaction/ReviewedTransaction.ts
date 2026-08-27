export type ReviewedTransaction = Readonly<{
  transactionXdrBase64: string;
  networkId: string;
  source: string;
  fee: string;
  expiresAtUnixSeconds?: number;
}>;
