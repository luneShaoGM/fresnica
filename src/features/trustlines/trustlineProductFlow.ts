import type { AccountSignerRepository } from '../../capabilities/account/AccountSignerRepository';
import type { AccountRecord } from '../../capabilities/account/types';
import type { BalanceGatewayPort } from '../../capabilities/balance/BalanceGateway';
import type { NetworkContext } from '../../capabilities/network/types';
import type { TrustlineGatewayPort } from '../../capabilities/trustline/TrustlineGateway';
import { buildTrustlineReview, type TrustlineReview } from '../../capabilities/trustline/buildTrustlineReview';
import {
  prepareTrustline,
  revalidateTrustlineReview,
  type TrustlineAction,
  type TrustlineAsset,
} from '../../capabilities/trustline/prepareTrustline';
import {
  submitReviewedTrustline,
  type SubmitReviewedTrustlineResult,
} from '../../capabilities/trustline/submitReviewedTrustline';
import type { FresnicaSdkPort } from '../../capabilities/ports/FresnicaSdkPort';

export type TrustlineProductDependencies = Readonly<{
  gateway: TrustlineGatewayPort & BalanceGatewayPort;
  sdk: FresnicaSdkPort;
  repository: AccountSignerRepository;
  network: NetworkContext;
}>;

export type TrustlineSubmissionResult =
  | SubmitReviewedTrustlineResult
  | Readonly<{ status: 'watch-only' }>
  | Readonly<{ status: 'unsupported-account-signers' }>;

export function prepareTrustlineProductReview(
  dependencies: TrustlineProductDependencies,
  account: AccountRecord,
  input: Readonly<{ action: TrustlineAction; asset: TrustlineAsset; limit?: string }>,
): Promise<TrustlineReview> {
  return prepareTrustline({ gateway: dependencies.gateway, network: dependencies.network }, account, input);
}

export async function submitTrustlineProductReview(
  dependencies: TrustlineProductDependencies,
  account: AccountRecord,
  review: TrustlineReview,
  appPassphrase?: string,
): Promise<TrustlineSubmissionResult> {
  const exactReview = buildTrustlineReview(
    { gateway: dependencies.gateway, network: dependencies.network },
    {
      transactionXdrBase64: review.transactionXdrBase64,
      networkId: review.networkId,
      operation: review.operation,
      ...(review.expectedAuthorization === undefined
        ? {}
        : {expectedAuthorization: review.expectedAuthorization}),
      ...(review.expectedClawbackEnabled === undefined
        ? {}
        : {expectedClawbackEnabled: review.expectedClawbackEnabled}),
    },
  );
  if (exactReview.source !== account.address || exactReview.networkId !== account.networkId) {
    throw new Error('trustline-review-account-mismatch');
  }

  const signers = dependencies.repository.listSignersForAccount(account.id);
  if (signers.length === 0) {
    return { status: 'watch-only' };
  }
  if (signers.length !== 1) {
    return { status: 'unsupported-account-signers' };
  }

  await revalidateTrustlineReview(
    {gateway: dependencies.gateway, network: dependencies.network},
    account,
    exactReview,
  );

  return submitReviewedTrustline({
    gateway: dependencies.gateway,
    sdk: dependencies.sdk,
    review: exactReview,
    signer: signers[0],
    ...(appPassphrase === undefined ? {} : { appPassphrase }),
    systemAuthReason: `${trustlineActionLabel(exactReview.operation)} ${exactReview.asset.code} trustline`,
    network: dependencies.network,
  });
}

function trustlineActionLabel(action: TrustlineAction): string {
  switch (action) {
    case 'add':
      return 'Add';
    case 'set-limit':
      return 'Set limit for';
    case 'remove':
      return 'Remove';
  }
}
