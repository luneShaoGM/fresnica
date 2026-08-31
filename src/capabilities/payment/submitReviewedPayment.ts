import type {FresnicaSdk} from '../../platform/fresnica/FresnicaSdk';
import type {StellarGateway} from '../../platform/stellar/StellarGateway';
import type {SignerRecord} from '../signer/types';
import {
  submitReviewedTransaction,
  type SubmitReviewedTransactionResult,
} from '../transaction/submitReviewedTransaction';
import type {PaymentReview} from './buildPaymentReview';

export type SubmitReviewedPaymentResult = SubmitReviewedTransactionResult;

export async function submitReviewedPayment(input: {
  gateway: StellarGateway;
  sdk: FresnicaSdk;
  review: PaymentReview;
  signer: SignerRecord;
  appPasscode?: string;
  systemAuthReason?: string;
}): Promise<SubmitReviewedPaymentResult> {
  return submitReviewedTransaction({
    gateway: input.gateway,
    sdk: input.sdk,
    review: input.review,
    signer: input.signer,
    thresholdLevel: 'medium',
    ...(input.appPasscode === undefined ? {} : {appPasscode: input.appPasscode}),
    ...(input.systemAuthReason === undefined
      ? {}
      : {systemAuthReason: input.systemAuthReason}),
  });
}
