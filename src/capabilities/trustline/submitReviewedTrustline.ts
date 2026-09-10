import type { NetworkContext } from '../network/types';
import type { FresnicaSdkPort } from '../ports/FresnicaSdkPort';
import type { TrustlineGatewayPort } from './TrustlineGateway';
import type { SignerRecord } from '../signer/types';
import {
  createTransactionIntentIdentity,
  type PendingSubmissionDependencies,
} from '../transaction/pendingSubmission';
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
  accountId: string;
  recovery: PendingSubmissionDependencies;
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
    accountId: input.accountId,
    intent: createTransactionIntentIdentity('trustline', [
      exactReview.operation,
      exactReview.asset.code,
      exactReview.asset.issuer,
      exactReview.limit ?? 'limit:none',
    ]),
    recovery: input.recovery,
    signer: input.signer,
    thresholdLevel: 'medium',
    ...(input.appPassphrase === undefined ? {} : { appPassphrase: input.appPassphrase }),
    ...(input.systemAuthReason === undefined ? {} : { systemAuthReason: input.systemAuthReason }),
    networkPassphrase: input.network.networkPassphrase,
  });
}
