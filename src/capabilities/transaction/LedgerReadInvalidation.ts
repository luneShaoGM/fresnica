export type LedgerReadInvalidation = Readonly<{
  networkId: string;
  accountId: string;
  transactionHash: string;
}>;

export interface LedgerReadInvalidationPort {
  invalidate(input: LedgerReadInvalidation): void;
}
