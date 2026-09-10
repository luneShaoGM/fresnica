import type { AccountSignerRepository } from '../../capabilities/account/AccountSignerRepository';
import type { AccountRecord } from '../../capabilities/account/types';
import type { BalanceGatewayPort } from '../../capabilities/balance/BalanceGateway';
import type { BalanceAsset } from '../../capabilities/balance/types';
import type { NetworkContext } from '../../capabilities/network/types';
import type { PaymentGatewayPort } from '../../capabilities/payment/PaymentGateway';
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
import type { SignerRecord } from '../../capabilities/signer/types';
import type { FresnicaSdkPort } from '../../capabilities/ports/FresnicaSdkPort';
import type { PendingSubmissionDependencies } from '../../capabilities/transaction/pendingSubmission';

export type SendProductDependencies = Readonly<{
  gateway: PaymentGatewayPort & BalanceGatewayPort;
  sdk: FresnicaSdkPort;
  repository: AccountSignerRepository;
  recovery: PendingSubmissionDependencies;
  network: NetworkContext;
}>;

export type SendDraft = Readonly<{
  destination: string;
  amount: string;
  asset: PaymentReviewAsset;
  memo?: string;
}>;

export type SendSubmissionResult =
  | SubmitReviewedPaymentResult
  | Readonly<{ status: 'watch-only' }>
  | Readonly<{ status: 'unsupported-account-signers' }>;

export async function buildSendReview(
  dependencies: SendProductDependencies,
  account: AccountRecord,
  draft: SendDraft,
): Promise<PaymentReview> {
  assertSendSource(account, dependencies.network.id);
  const signerResolution = resolveSingleAccountSigner(dependencies.repository, account.id);
  if (signerResolution.status === 'watch-only') {
    throw new Error('send-watch-only');
  }
  if (signerResolution.status === 'unsupported-account-signers') {
    throw new Error('send-unsupported-account-signers');
  }

  return preparePayment({ gateway: dependencies.gateway, network: dependencies.network }, account, draft);
}

export async function submitSendReview(
  dependencies: SendProductDependencies,
  account: AccountRecord,
  review: PaymentReview,
  appPassphrase?: string,
): Promise<SendSubmissionResult> {
  assertSendSource(account, dependencies.network.id);

  // Re-derive semantics from the exact XDR at the submission boundary rather
  // than trusting mutable/plain JS review fields supplied by the caller.
  const exactReview = buildPaymentReview(
    { gateway: dependencies.gateway, network: dependencies.network },
    {
      transactionXdrBase64: review.transactionXdrBase64,
      networkId: review.networkId,
    },
  );
  if (exactReview.source !== account.address || exactReview.networkId !== account.networkId) {
    throw new Error('send-review-account-mismatch');
  }

  const signerResolution = resolveSingleAccountSigner(dependencies.repository, account.id);
  if (signerResolution.status !== 'ready') {
    return signerResolution;
  }

  return submitReviewedPayment({
    gateway: dependencies.gateway,
    sdk: dependencies.sdk,
    review: exactReview,
    accountId: account.id,
    recovery: dependencies.recovery,
    signer: signerResolution.signer,
    ...(appPassphrase ? { appPassphrase } : {}),
    systemAuthReason: `${exactReview.operation === 'create-account' ? 'Create account with' : 'Send'} ${exactReview.amount} ${assetCode(exactReview.asset)}`,
    networkPassphrase: dependencies.network.networkPassphrase,
  });
}

export function validateDestination(dependencies: Pick<SendProductDependencies, 'gateway'>, value: string): string {
  return validateClassicDestination(value, address => dependencies.gateway.isClassicAccountAddress(address));
}
export const validateStellarAmount = validatePaymentAmount;
export const validateTextMemo = validatePaymentTextMemo;

export function sendAssetKey(asset: BalanceAsset | PaymentReviewAsset): string {
  return asset.kind === 'native' ? 'XLM' : `${asset.code}:${asset.issuer}`;
}

function assertSendSource(account: AccountRecord, networkId: string): void {
  if (account.networkId !== networkId) {
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
  | Readonly<{ status: 'ready'; signer: SignerRecord }>
  | Readonly<{ status: 'watch-only' }>
  | Readonly<{ status: 'unsupported-account-signers' }> {
  const signers = repository.listSignersForAccount(accountId);
  if (signers.length === 0) {
    return { status: 'watch-only' };
  }
  if (signers.length !== 1) {
    return { status: 'unsupported-account-signers' };
  }
  return { status: 'ready', signer: signers[0] };
}

function assetCode(asset: PaymentReviewAsset): string {
  return asset.kind === 'native' ? 'XLM' : asset.code;
}
