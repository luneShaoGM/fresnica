import type { ClassicLedgerAuthorization } from '../ledger-authorization/types';
import type {
  TransactionReconciliationResult,
  TransactionSubmissionResult,
} from './submission';

export interface TransactionGatewayPort {
  loadAccountAuthorization(address: string): Promise<ClassicLedgerAuthorization>;
  transactionHash(signedXdrBase64: string): string;
  loadTransactionOutcome(transactionHash: string): Promise<TransactionReconciliationResult>;
  submitTransaction(signedXdrBase64: string): Promise<TransactionSubmissionResult>;
}
