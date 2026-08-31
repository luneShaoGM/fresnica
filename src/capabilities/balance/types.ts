export type BalanceAsset =
  | Readonly<{kind: 'native'; code: 'XLM'}>
  | Readonly<{kind: 'credit'; code: string; issuer: string}>;

export type BalanceLine = Readonly<{
  asset: BalanceAsset;
  balance: string;
}>;

export type BalanceSnapshot =
  | Readonly<{
      status: 'unsupported-account';
      address: string;
    }>
  | Readonly<{
      status: 'inactive';
      address: string;
    }>
  | Readonly<{
      status: 'active';
      address: string;
      balances: readonly BalanceLine[];
      hiddenLiquidityPoolShareCount: number;
    }>;
