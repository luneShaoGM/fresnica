import type { FresnicaSdkPort } from '../ports/FresnicaSdkPort';
import type { TransactionGatewayPort } from '../transaction/TransactionGateway';
import {
  createTransactionIntentIdentity,
  type PendingSubmissionDependencies,
} from '../transaction/pendingSubmission';
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
  accountId: string;
  recovery: PendingSubmissionDependencies;
  signer: SignerRecord;
  appPassphrase?: string;
  systemAuthReason?: string;
  networkPassphrase: string;
}): Promise<SubmitReviewedPaymentResult> {
  return submitReviewedTransaction({
    gateway: input.gateway,
    sdk: input.sdk,
    review: input.review,
    accountId: input.accountId,
    intent: paymentSubmissionIntent(input.review),
    recovery: input.recovery,
    signer: input.signer,
    thresholdLevel: 'medium',
    ...(input.appPassphrase === undefined ? {} : { appPassphrase: input.appPassphrase }),
    ...(input.systemAuthReason === undefined ? {} : { systemAuthReason: input.systemAuthReason }),
    networkPassphrase: input.networkPassphrase,
  });
}

function paymentSubmissionIntent(review: PaymentReview) {
  const assetComponents =
    review.asset.kind === 'native'
      ? ['native']
      : ['credit', review.asset.code, review.asset.issuer];
  return createTransactionIntentIdentity('payment', [
    review.operation,
    review.destination,
    ...assetComponents,
    review.amount,
    review.memo === undefined ? 'memo:none' : 'memo:text',
    review.memo ?? '',
  ]);
}
