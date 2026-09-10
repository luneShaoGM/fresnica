import type { FresnicaSdkPort } from '../ports/FresnicaSdkPort';
import type { TransactionGatewayPort } from '../transaction/TransactionGateway';
import type { SignerRecord } from '../signer/types';
import {
  submitReviewedTransaction,
  type SubmitReviewedTransactionResult,
} from '../transaction/submitReviewedTransaction';
import type { PaymentReview } from './buildPaymentReview';

export type SubmitReviewedPaymentResult = SubmitReviewedTransactionResult;

export async function submitReviewedPayment(input: {
  gateway: TransactionGatewayPort;
  sdk: FresnicaSdkPort;
  review: PaymentReview;
  signer: SignerRecord;
  appPassphrase?: string;
  systemAuthReason?: string;
  networkPassphrase: string;
}): Promise<SubmitReviewedPaymentResult> {
  return submitReviewedTransaction({
    gateway: input.gateway,
    sdk: input.sdk,
    review: input.review,
    signer: input.signer,
    thresholdLevel: 'medium',
    ...(input.appPassphrase === undefined ? {} : { appPassphrase: input.appPassphrase }),
    ...(input.systemAuthReason === undefined ? {} : { systemAuthReason: input.systemAuthReason }),
    networkPassphrase: input.networkPassphrase,
  });
}
