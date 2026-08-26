import type { Transaction, TransactionSource } from '@stellar/stellar-sdk';

export type HorizonAccountLike = TransactionSource & {
  account_id: string;
  thresholds: {
    low_threshold: number;
    med_threshold: number;
    high_threshold: number;
  };
  signers: Array<{
    key: string;
    weight: number;
    type: string;
  }>;
};

export type HorizonServerLike = {
  loadAccount(address: string): Promise<HorizonAccountLike>;
  submitTransaction(transaction: Transaction): Promise<{
    hash: string;
    ledger?: number;
  }>;
};

export type StellarPaymentAsset =
  | { kind: 'native' }
  | { kind: 'credit'; code: string; issuer: string };

export type BuildPaymentInput = {
  source: string;
  destination: string;
  asset: StellarPaymentAsset;
  amount: string;
  memo?: string;
  baseFee: string;
};

export type BuiltTransaction = {
  source: string;
  networkId: 'stellar-testnet';
  transactionXdrBase64: string;
};

export type SubmittedTransaction = {
  hash: string;
  ledger?: number;
};
