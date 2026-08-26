import type { StellarAccountAuthorization } from '../accounts/types';
import type {
  BuildPaymentInput,
  BuiltTransaction,
  SubmittedTransaction,
} from './types';

export interface StellarGateway {
  loadAccountAuthorization(address: string): Promise<StellarAccountAuthorization>;
  buildPayment(input: BuildPaymentInput): Promise<BuiltTransaction>;
  submitTransaction(signedXdrBase64: string): Promise<SubmittedTransaction>;
}
