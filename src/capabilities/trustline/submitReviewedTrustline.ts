import type {FresnicaSdk} from '../../platform/fresnica/FresnicaSdk';
import type {StellarGateway} from '../../platform/stellar/StellarGateway';
import type {SignerRecord} from '../signer/types';
import {
  submitReviewedTransaction,
  type SubmitReviewedTransactionResult,
} from '../transaction/submitReviewedTransaction';
import {buildTrustlineReview, type TrustlineReview} from './buildTrustlineReview';

export type SubmitReviewedTrustlineResult = SubmitReviewedTransactionResult;

export async function submitReviewedTrustline(input: {
  gateway: StellarGateway;
  sdk: FresnicaSdk;
  review: TrustlineReview;
  signer: SignerRecord;
  appPasscode?: string;
  systemAuthReason?: string;
}): Promise<SubmitReviewedTrustlineResult> {
  const exactReview = buildTrustlineReview({
    transactionXdrBase64: input.review.transactionXdrBase64,
    networkId: input.review.networkId,
  });

  return submitReviewedTransaction({
    gateway: input.gateway,
    sdk: input.sdk,
    review: exactReview,
    signer: input.signer,
    thresholdLevel: 'medium',
    ...(input.appPasscode === undefined ? {} : {appPasscode: input.appPasscode}),
    ...(input.systemAuthReason === undefined
      ? {}
      : {systemAuthReason: input.systemAuthReason}),
  });
}
