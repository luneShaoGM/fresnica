import type {
  BuildChangeTrustInput,
  BuiltTransaction,
  StellarAccountStateResult,
  StellarLedgerParameters,
  StellarLiquidityPoolState,
} from '../stellar/types';
import type { TransactionGatewayPort } from '../transaction/TransactionGateway';

export type TrustlineTransactionProjection = Readonly<{
  source: string;
  fee: string;
  expiresAtUnixSeconds?: number;
  asset: Readonly<{ code: string; issuer: string }>;
  limit?: string;
}>;

export interface TrustlineGatewayPort extends TransactionGatewayPort {
  isClassicAccountAddress(address: string): boolean;
  loadAccountState(address: string): Promise<StellarAccountStateResult>;
  loadLedgerParameters(): Promise<StellarLedgerParameters>;
  loadLiquidityPool(id: string): Promise<StellarLiquidityPoolState>;
  buildChangeTrust(input: BuildChangeTrustInput): Promise<BuiltTransaction>;
  inspectTrustlineTransaction(
    input: Readonly<{
      transactionXdrBase64: string;
      networkPassphrase: string;
    }>,
  ): TrustlineTransactionProjection;
}
