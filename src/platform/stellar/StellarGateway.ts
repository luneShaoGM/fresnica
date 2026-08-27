import type { ClassicLedgerAuthorization } from '../../capabilities/ledger-authorization/types';
import type { TransactionSubmissionResult } from '../../capabilities/transaction/submission';
import type { BuildPaymentInput, BuiltTransaction } from './types';

export interface StellarGateway {
  loadAccountAuthorization(address: string): Promise<ClassicLedgerAuthorization>;
  buildPayment(input: BuildPaymentInput): Promise<BuiltTransaction>;
  submitTransaction(signedXdrBase64: string): Promise<TransactionSubmissionResult>;
}
