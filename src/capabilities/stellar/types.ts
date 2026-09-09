export type StellarBalanceLine =
  | Readonly<{ kind: 'native'; balance: string }>
  | Readonly<{ kind: 'credit'; balance: string; code: string; issuer: string; limit?: string }>
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
  | Readonly<{ status: 'inactive'; address: string }>;

export type StellarTrustlineBalance = Readonly<{
  kind: 'credit';
  balance: string;
  limit?: string;
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
  buyingLiabilities?: string;
  sellingLiabilities: string;
}>;

export type StellarAccountState = Readonly<{
  address: string;
  subentryCount: number;
  numSponsoring: number;
  numSponsored: number;
  memoRequired?: boolean;
  flags: Readonly<{
    authRequired: boolean;
    authClawbackEnabled: boolean;
  }>;
  balances: readonly (StellarNativeBalance | StellarTrustlineBalance | StellarLiquidityPoolBalance)[];
}>;

export type StellarAccountStateResult =
  Readonly<{ status: 'active'; account: StellarAccountState }> | Readonly<{ status: 'inactive'; address: string }>;

export type StellarLedgerParameters = Readonly<{
  baseFeeStroops: number;
  baseReserveStroops: number;
}>;

export type StellarLiquidityPoolState = Readonly<{
  id: string;
  reserveAssets: readonly string[];
}>;

export type StellarPaymentAsset =
  Readonly<{ kind: 'native' }> | Readonly<{ kind: 'credit'; code: string; issuer: string }>;

export type BuildPaymentInput = Readonly<{
  operation: 'payment' | 'create-account';
  source: string;
  destination: string;
  asset: StellarPaymentAsset;
  amount: string;
  memo?: string;
  baseFee: string;
}>;

export type BuildChangeTrustInput = Readonly<{
  source: string;
  code: string;
  issuer: string;
  limit: string;
  baseFee: string;
}>;

export type BuiltTransaction = Readonly<{
  source: string;
  networkId: string;
  transactionXdrBase64: string;
}>;
