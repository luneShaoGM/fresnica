import type { ClassicLedgerAuthorization } from '../../capabilities/ledger-authorization/types';
import type { TransactionSubmissionResult } from '../../capabilities/transaction/submission';
import type {
  BuildChangeTrustInput,
  BuildPathPaymentStrictReceiveInput,
  BuildPathPaymentStrictSendInput,
  BuildPaymentInput,
  BuiltTransaction,
  LoadStrictReceivePathsInput,
  LoadStrictSendPathsInput,
  StellarAccountBalanceResult,
  StellarAccountOperationResult,
  StellarAccountStateResult,
  StellarLedgerParameters,
  StellarLiquidityPoolState,
  StellarPathPaymentRoute,
} from './types';

export interface StellarGateway {
  loadAccountAuthorization(address: string): Promise<ClassicLedgerAuthorization>;
  loadAccountBalances(address: string): Promise<StellarAccountBalanceResult>;
  loadAccountState(address: string): Promise<StellarAccountStateResult>;
  loadAccountOperations(input: {
    address: string;
    cursor?: string;
    limit: number;
  }): Promise<StellarAccountOperationResult>;
  loadLedgerParameters(): Promise<StellarLedgerParameters>;
  loadLiquidityPool(id: string): Promise<StellarLiquidityPoolState>;
  buildPayment(input: BuildPaymentInput): Promise<BuiltTransaction>;
  buildChangeTrust(input: BuildChangeTrustInput): Promise<BuiltTransaction>;
  submitTransaction(signedXdrBase64: string): Promise<TransactionSubmissionResult>;
}

export interface StellarPathPaymentGateway {
  loadStrictSendPaths(
    input: LoadStrictSendPathsInput,
  ): Promise<readonly StellarPathPaymentRoute[]>;
  loadStrictReceivePaths(
    input: LoadStrictReceivePathsInput,
  ): Promise<readonly StellarPathPaymentRoute[]>;
  buildPathPaymentStrictSend(
    input: BuildPathPaymentStrictSendInput,
  ): Promise<BuiltTransaction>;
  buildPathPaymentStrictReceive(
    input: BuildPathPaymentStrictReceiveInput,
  ): Promise<BuiltTransaction>;
}
