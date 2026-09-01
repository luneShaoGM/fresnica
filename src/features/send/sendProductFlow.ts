import {APP_CONFIG} from '../../app/config/appConfig';
import type {AccountSignerRepository} from '../../capabilities/account/AccountSignerRepository';
import type {AccountRecord} from '../../capabilities/account/types';
import type {BalanceAsset} from '../../capabilities/balance/types';
import {
  buildPaymentReview,
  type PaymentReview,
  type PaymentReviewAsset,
} from '../../capabilities/payment/buildPaymentReview';
import {
  preparePayment,
  validateClassicDestination,
  validatePaymentAmount,
  validatePaymentTextMemo,
} from '../../capabilities/payment/preparePayment';
import {
  submitReviewedPayment,
  type SubmitReviewedPaymentResult,
} from '../../capabilities/payment/submitReviewedPayment';
import type {SignerRecord} from '../../capabilities/signer/types';
import type {FresnicaSdk} from '../../platform/fresnica/FresnicaSdk';
import type {StellarGateway} from '../../platform/stellar/StellarGateway';

export type SendProductDependencies = Readonly<{
  gateway: StellarGateway;
  sdk: FresnicaSdk;
  repository: AccountSignerRepository;
}>;

export type SendDraft = Readonly<{
  destination: string;
  amount: string;
  asset: PaymentReviewAsset;
  memo?: string;
}>;

export type SendSubmissionResult =
  | SubmitReviewedPaymentResult
  | Readonly<{status: 'watch-only'}>
  | Readonly<{status: 'unsupported-account-signers'}>;

export async function buildSendReview(
  dependencies: SendProductDependencies,
  account: AccountRecord,
  draft: SendDraft,
): Promise<PaymentReview> {
  assertSendSource(account);
  const signerResolution = resolveSingleAccountSigner(
    dependencies.repository,
    account.id,
  );
  if (signerResolution.status === 'watch-only') {
    throw new Error('send-watch-only');
  }
  if (signerResolution.status === 'unsupported-account-signers') {
    throw new Error('send-unsupported-account-signers');
  }

  return preparePayment({gateway: dependencies.gateway}, account, draft);
}

export async function submitSendReview(
  dependencies: SendProductDependencies,
  account: AccountRecord,
  review: PaymentReview,
  appPasscode?: string,
): Promise<SendSubmissionResult> {
  assertSendSource(account);

  // Re-derive semantics from the exact XDR at the submission boundary rather
  // than trusting mutable/plain JS review fields supplied by the caller.
  const exactReview = buildPaymentReview({
    transactionXdrBase64: review.transactionXdrBase64,
    networkId: review.networkId,
  });
  if (
    exactReview.source !== account.address ||
    exactReview.networkId !== account.networkId
  ) {
    throw new Error('send-review-account-mismatch');
  }

  const signerResolution = resolveSingleAccountSigner(
    dependencies.repository,
    account.id,
  );
  if (signerResolution.status !== 'ready') {
    return signerResolution;
  }

  return submitReviewedPayment({
    gateway: dependencies.gateway,
    sdk: dependencies.sdk,
    review: exactReview,
    signer: signerResolution.signer,
    ...(appPasscode ? {appPasscode} : {}),
    systemAuthReason: `${exactReview.operation === 'create-account' ? 'Create account with' : 'Send'} ${exactReview.amount} ${assetCode(exactReview.asset)}`,
  });
}

export const validateDestination = validateClassicDestination;
export const validateStellarAmount = validatePaymentAmount;
export const validateTextMemo = validatePaymentTextMemo;

export function sendAssetKey(asset: BalanceAsset | PaymentReviewAsset): string {
  return asset.kind === 'native' ? 'XLM' : `${asset.code}:${asset.issuer}`;
}

function assertSendSource(account: AccountRecord): void {
  if (account.networkId !== APP_CONFIG.network.id) {
    throw new Error('send-network-mismatch');
  }
  if (account.identityKind !== 'classic') {
    throw new Error('send-requires-classic-account');
  }
}

function resolveSingleAccountSigner(
  repository: AccountSignerRepository,
  accountId: string,
):
  | Readonly<{status: 'ready'; signer: SignerRecord}>
  | Readonly<{status: 'watch-only'}>
  | Readonly<{status: 'unsupported-account-signers'}> {
  const signers = repository.listSignersForAccount(accountId);
  if (signers.length === 0) {
    return {status: 'watch-only'};
  }
  if (signers.length !== 1) {
    return {status: 'unsupported-account-signers'};
  }
  return {status: 'ready', signer: signers[0]};
}

function assetCode(asset: PaymentReviewAsset): string {
  return asset.kind === 'native' ? 'XLM' : asset.code;
}
