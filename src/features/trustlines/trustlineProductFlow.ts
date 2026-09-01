import type {AccountSignerRepository} from '../../capabilities/account/AccountSignerRepository';
import type {AccountRecord} from '../../capabilities/account/types';
import {
  buildTrustlineReview,
  type TrustlineReview,
} from '../../capabilities/trustline/buildTrustlineReview';
import {
  prepareTrustline,
  type TrustlineAction,
  type TrustlineAsset,
} from '../../capabilities/trustline/prepareTrustline';
import {
  submitReviewedTrustline,
  type SubmitReviewedTrustlineResult,
} from '../../capabilities/trustline/submitReviewedTrustline';
import type {FresnicaSdk} from '../../platform/fresnica/FresnicaSdk';
import type {StellarGateway} from '../../platform/stellar/StellarGateway';

export type TrustlineProductDependencies = Readonly<{
  gateway: StellarGateway;
  sdk: FresnicaSdk;
  repository: AccountSignerRepository;
}>;

export type TrustlineSubmissionResult =
  | SubmitReviewedTrustlineResult
  | Readonly<{status: 'watch-only'}>
  | Readonly<{status: 'unsupported-account-signers'}>;

export function prepareTrustlineProductReview(
  dependencies: TrustlineProductDependencies,
  account: AccountRecord,
  input: Readonly<{action: TrustlineAction; asset: TrustlineAsset}>,
): Promise<TrustlineReview> {
  return prepareTrustline({gateway: dependencies.gateway}, account, input);
}

export async function submitTrustlineProductReview(
  dependencies: TrustlineProductDependencies,
  account: AccountRecord,
  review: TrustlineReview,
  appPasscode?: string,
): Promise<TrustlineSubmissionResult> {
  const exactReview = buildTrustlineReview({
    transactionXdrBase64: review.transactionXdrBase64,
    networkId: review.networkId,
  });
  if (
    exactReview.source !== account.address ||
    exactReview.networkId !== account.networkId
  ) {
    throw new Error('trustline-review-account-mismatch');
  }

  const signers = dependencies.repository.listSignersForAccount(account.id);
  if (signers.length === 0) {
    return {status: 'watch-only'};
  }
  if (signers.length !== 1) {
    return {status: 'unsupported-account-signers'};
  }

  return submitReviewedTrustline({
    gateway: dependencies.gateway,
    sdk: dependencies.sdk,
    review: exactReview,
    signer: signers[0],
    ...(appPasscode === undefined ? {} : {appPasscode}),
    systemAuthReason: `${exactReview.operation === 'add' ? 'Add' : 'Remove'} ${exactReview.asset.code} trustline`,
  });
}
