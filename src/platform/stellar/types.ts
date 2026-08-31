import type { Transaction, TransactionSource } from '@stellar/stellar-sdk';

export type HorizonBalanceLike = {
  asset_type: string;
  balance: string;
  asset_code?: string;
  asset_issuer?: string;
  liquidity_pool_id?: string;
  buying_liabilities?: string;
  selling_liabilities?: string;
  is_authorized?: boolean;
  is_authorized_to_maintain_liabilities?: boolean;
  is_clawback_enabled?: boolean;
};

export type HorizonAccountLike = TransactionSource & {
  account_id: string;
  subentry_count?: number;
  num_sponsoring?: number;
  num_sponsored?: number;
  flags?: {
    auth_required?: boolean;
    auth_clawback_enabled?: boolean;
  };
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

export type HorizonOperationLike = {
  id: string;
  paging_token: string;
  type: string;
  type_i: number;
  created_at: string;
  transaction_hash: string;
  transaction_successful: boolean;
  source_account: string;
  from?: string;
  to?: string;
  to_muxed?: string;
  amount?: string;
  asset_type?: string;
  asset_code?: string;
  asset_issuer?: string;
  funder?: string;
  account?: string;
  starting_balance?: string;
};

export type HorizonOperationPageLike = Readonly<{
  records: readonly HorizonOperationLike[];
}>;

export type LoadAccountOperationsInput = Readonly<{
  address: string;
  cursor?: string;
  limit: number;
}>;

export type HorizonLedgerParametersLike = Readonly<{
  base_fee_in_stroops: number;
  base_reserve_in_stroops: number;
}>;

export type HorizonLiquidityPoolLike = Readonly<{
  id: string;
  reserves: readonly Readonly<{asset: string}>[];
}>;

export type HorizonServerLike = {
  loadAccount(address: string): Promise<HorizonAccountLike>;
  loadAccountOperations(input: LoadAccountOperationsInput): Promise<HorizonOperationPageLike>;
  loadLedgerParameters(): Promise<HorizonLedgerParametersLike>;
  loadLiquidityPool(id: string): Promise<HorizonLiquidityPoolLike>;
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

export type StellarAccountOperationResult =
  | Readonly<{
      status: 'active';
      address: string;
      records: readonly HorizonOperationLike[];
      nextCursor?: string;
    }>
  | Readonly<{
      status: 'inactive';
      address: string;
    }>;

export type StellarTrustlineBalance = Readonly<{
  kind: 'credit';
  balance: string;
  buyingLiabilities: string;
  sellingLiabilities: string;
  code: string;
  issuer: string;
  isAuthorized: boolean;
  isAuthorizedToMaintainLiabilities: boolean;
  isClawbackEnabled: boolean;
}>;

export type StellarLiquidityPoolBalance = Readonly<{
  kind: 'liquidity-pool-share';
  balance: string;
  liquidityPoolId: string;
}>;

export type StellarNativeBalance = Readonly<{
  kind: 'native';
  balance: string;
  sellingLiabilities: string;
}>;

export type StellarAccountState = Readonly<{
  address: string;
  subentryCount: number;
  numSponsoring: number;
  numSponsored: number;
  flags: Readonly<{
    authRequired: boolean;
    authClawbackEnabled: boolean;
  }>;
  balances: readonly (
    | StellarNativeBalance
    | StellarTrustlineBalance
    | StellarLiquidityPoolBalance
  )[];
}>;

export type StellarAccountStateResult =
  | Readonly<{status: 'active'; account: StellarAccountState}>
  | Readonly<{status: 'inactive'; address: string}>;

export type StellarLedgerParameters = Readonly<{
  baseFeeStroops: number;
  baseReserveStroops: number;
}>;

export type StellarLiquidityPoolState = Readonly<{
  id: string;
  reserveAssets: readonly string[];
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

export type BuildChangeTrustInput = Readonly<{
  source: string;
  code: string;
  issuer: string;
  limit: string;
  baseFee: string;
}>;

export type BuiltTransaction = {
  source: string;
  networkId: 'stellar-testnet';
  transactionXdrBase64: string;
};
