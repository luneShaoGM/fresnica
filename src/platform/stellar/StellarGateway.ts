import type { ClassicLedgerAuthorization } from '../../capabilities/ledger-authorization/types';
import type { TransactionSubmissionResult } from '../../capabilities/transaction/submission';
import type {
  BuildPaymentInput,
  BuiltTransaction,
  StellarAccountBalanceResult,
  StellarAccountOperationResult,
} from './types';

export interface StellarGateway {
  loadAccountAuthorization(address: string): Promise<ClassicLedgerAuthorization>;
  loadAccountBalances(address: string): Promise<StellarAccountBalanceResult>;
  loadAccountOperations(input: {
    address: string;
    cursor?: string;
    limit: number;
  }): Promise<StellarAccountOperationResult>;
  buildPayment(input: BuildPaymentInput): Promise<BuiltTransaction>;
  submitTransaction(signedXdrBase64: string): Promise<TransactionSubmissionResult>;
}
