import type {Asset, TransactionSource} from '@stellar/stellar-sdk';

import type { BuiltTransaction, StellarPaymentAsset } from '../../capabilities/stellar/types';

export type {
  BuildChangeTrustInput,
  BuildPaymentInput,
  BuiltTransaction,
  StellarAccountBalanceResult,
  StellarAccountState,
  StellarAccountStateResult,
  StellarBalanceLine,
  StellarLedgerParameters,
  StellarLiquidityPoolBalance,
  StellarLiquidityPoolState,
  StellarNativeBalance,
  StellarPaymentAsset,
  StellarTrustlineBalance,
} from '../../capabilities/stellar/types';

export type HorizonBalanceLike = {
  asset_type: string;
  balance: string;
  asset_code?: string;
  asset_issuer?: string;
  liquidity_pool_id?: string;
  limit?: string;
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
  data_attr?: Record<string, string>;
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
  reserves: readonly Readonly<{ asset: string }>[];
}>;

export type HorizonTransactionLike = Readonly<{
  hash: string;
  ledger: number;
  successful: boolean;
}>;

export type HorizonPathAssetLike = Readonly<{
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
}>;

export type HorizonPathRecordLike = Readonly<{
  source_amount: string;
  destination_amount: string;
  path: readonly HorizonPathAssetLike[];
}>;

export type HorizonPathPageLike = Readonly<{
  records: readonly HorizonPathRecordLike[];
}>;

export type HorizonPathServerLike = {
  loadStrictSendPaths(
    input: Readonly<{
      sourceAsset: Asset;
      sourceAmount: string;
      destinationAssets: readonly Asset[];
    }>,
  ): Promise<HorizonPathPageLike>;
  loadStrictReceivePaths(
    input: Readonly<{
      sourceAssets: readonly Asset[];
      destinationAsset: Asset;
      destinationAmount: string;
    }>,
  ): Promise<HorizonPathPageLike>;
};

export type HorizonServerLike = {
  loadAccount(address: string): Promise<HorizonAccountLike>;
  loadAccountOperations(input: LoadAccountOperationsInput): Promise<HorizonOperationPageLike>;
  loadOperation(operationId: string): Promise<HorizonOperationLike>;
  loadLedgerParameters(): Promise<HorizonLedgerParametersLike>;
  loadLiquidityPool(id: string): Promise<HorizonLiquidityPoolLike>;
  loadTransaction(transactionHash: string): Promise<HorizonTransactionLike>;
  submitTransaction(signedXdrBase64: string): Promise<{
    hash: string;
    ledger?: number;
  }>;
};

export type StellarPathPaymentRoute = Readonly<{
  sourceAmount: string;
  destinationAmount: string;
  path: readonly StellarPaymentAsset[];
}>;

export type LoadStrictSendPathsInput = Readonly<{
  sourceAsset: StellarPaymentAsset;
  sourceAmount: string;
  destinationAssets: readonly StellarPaymentAsset[];
}>;

export type LoadStrictReceivePathsInput = Readonly<{
  sourceAssets: readonly StellarPaymentAsset[];
  destinationAsset: StellarPaymentAsset;
  destinationAmount: string;
}>;

export type BuildPathPaymentStrictSendInput = Readonly<{
  source: string;
  destination: string;
  sendAsset: StellarPaymentAsset;
  sendAmount: string;
  destinationAsset: StellarPaymentAsset;
  destinationMinimum: string;
  path: readonly StellarPaymentAsset[];
  baseFee: string;
  timeoutSeconds: number;
}>;

export type BuildPathPaymentStrictReceiveInput = Readonly<{
  source: string;
  destination: string;
  sendAsset: StellarPaymentAsset;
  sendMaximum: string;
  destinationAsset: StellarPaymentAsset;
  destinationAmount: string;
  path: readonly StellarPaymentAsset[];
  baseFee: string;
  timeoutSeconds: number;
}>;

export type PathPaymentBuiltTransaction = BuiltTransaction;
