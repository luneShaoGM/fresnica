import type { Transaction, TransactionSource } from '@stellar/stellar-sdk';

export type HorizonBalanceLike = {
  asset_type: string;
  balance: string;
  asset_code?: string;
  asset_issuer?: string;
  liquidity_pool_id?: string;
};

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
  balances: HorizonBalanceLike[];
};

export type HorizonServerLike = {
  loadAccount(address: string): Promise<HorizonAccountLike>;
  submitTransaction(transaction: Transaction): Promise<{
    hash: string;
    ledger?: number;
  }>;
};

export type StellarBalanceLine =
  | Readonly<{
      kind: 'native';
      balance: string;
    }>
  | Readonly<{
      kind: 'credit';
      balance: string;
      code: string;
      issuer: string;
    }>
  | Readonly<{
      kind: 'liquidity-pool-share';
      balance: string;
      liquidityPoolId: string;
    }>;

export type StellarAccountBalanceResult =
  | Readonly<{
      status: 'active';
      address: string;
      balances: readonly StellarBalanceLine[];
    }>
  | Readonly<{
      status: 'inactive';
      address: string;
    }>;

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
