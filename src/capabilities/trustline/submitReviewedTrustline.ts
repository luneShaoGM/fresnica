import type { NetworkContext } from '../network/types';
import type { FresnicaSdkPort } from '../ports/FresnicaSdkPort';
import type { TrustlineGatewayPort } from './TrustlineGateway';
import type { SignerRecord } from '../signer/types';
import {
  submitReviewedTransaction,
  type SubmitReviewedTransactionResult,
} from '../transaction/submitReviewedTransaction';
import { buildTrustlineReview, type TrustlineReview } from './buildTrustlineReview';

export type SubmitReviewedTrustlineResult = SubmitReviewedTransactionResult;

export async function submitReviewedTrustline(input: {
  gateway: TrustlineGatewayPort;
  sdk: FresnicaSdkPort;
  review: TrustlineReview;
  signer: SignerRecord;
  appPassphrase?: string;
  systemAuthReason?: string;
  network: NetworkContext;
}): Promise<SubmitReviewedTrustlineResult> {
  const exactReview = buildTrustlineReview(
    { gateway: input.gateway, network: input.network },
    {
      transactionXdrBase64: input.review.transactionXdrBase64,
      networkId: input.review.networkId,
      operation: input.review.operation,
      ...(input.review.expectedAuthorization === undefined
        ? {}
        : {expectedAuthorization: input.review.expectedAuthorization}),
      ...(input.review.expectedClawbackEnabled === undefined
        ? {}
        : {expectedClawbackEnabled: input.review.expectedClawbackEnabled}),
    },
  );

  return submitReviewedTransaction({
    gateway: input.gateway,
    sdk: input.sdk,
    review: exactReview,
    signer: input.signer,
    thresholdLevel: 'medium',
    ...(input.appPassphrase === undefined ? {} : { appPassphrase: input.appPassphrase }),
    ...(input.systemAuthReason === undefined ? {} : { systemAuthReason: input.systemAuthReason }),
    networkPassphrase: input.network.networkPassphrase,
  });
}
