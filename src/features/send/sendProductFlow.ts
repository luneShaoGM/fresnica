import {StrKey} from '@stellar/stellar-sdk';

import {APP_CONFIG} from '../../app/config/appConfig';
import type {AccountSignerRepository} from '../../capabilities/account/AccountSignerRepository';
import type {AccountRecord} from '../../capabilities/account/types';
import {
  buildPaymentReview,
  type PaymentReview,
  type PaymentReviewAsset,
} from '../../capabilities/payment/buildPaymentReview';
import {
  submitReviewedPayment,
  type SubmitReviewedPaymentResult,
} from '../../capabilities/payment/submitReviewedPayment';
import type {SignerRecord} from '../../capabilities/signer/types';
import type {FresnicaSdk} from '../../platform/fresnica/FresnicaSdk';
import type {StellarGateway} from '../../platform/stellar/StellarGateway';

const DEFAULT_BASE_FEE_STROOPS = '100';
const MAX_STELLAR_AMOUNT_STROOPS = 9_223_372_036_854_775_807n;

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
  const destination = validateDestination(draft.destination);
  const amount = validateStellarAmount(draft.amount);
  const asset = validateAsset(draft.asset);
  const memo = draft.memo?.trim();

  const built = await dependencies.gateway.buildPayment({
    source: account.address,
    destination,
    asset,
    amount,
    ...(memo ? {memo} : {}),
    baseFee: DEFAULT_BASE_FEE_STROOPS,
  });

  if (built.source !== account.address || built.networkId !== account.networkId) {
    throw new Error('send-built-transaction-context-mismatch');
  }

  return buildPaymentReview({
    transactionXdrBase64: built.transactionXdrBase64,
    networkId: built.networkId,
  });
}

export async function submitSendReview(
  dependencies: SendProductDependencies,
  account: AccountRecord,
  review: PaymentReview,
  appPasscode?: string,
): Promise<SendSubmissionResult> {
  assertSendSource(account);
  if (review.source !== account.address || review.networkId !== account.networkId) {
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
    review,
    signer: signerResolution.signer,
    ...(appPasscode ? {appPasscode} : {}),
    systemAuthReason: 'Confirm Fresnica payment',
  });
}

export function validateDestination(value: string): string {
  const destination = value.trim();
  if (
    !StrKey.isValidEd25519PublicKey(destination) &&
    !StrKey.isValidMed25519PublicKey(destination)
  ) {
    throw new Error('invalid-stellar-destination');
  }
  return destination;
}

export function validateStellarAmount(value: string): string {
  const amount = value.trim();
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,7}))?$/.exec(amount);
  if (!match) {
    throw new Error('invalid-stellar-amount');
  }

  const whole = BigInt(match[1]);
  const fraction = (match[2] ?? '').padEnd(7, '0');
  const stroops = whole * 10_000_000n + BigInt(fraction || '0');
  if (stroops <= 0n || stroops > MAX_STELLAR_AMOUNT_STROOPS) {
    throw new Error('invalid-stellar-amount');
  }

  return amount;
}

function assertSendSource(account: AccountRecord): void {
  if (account.networkId !== APP_CONFIG.network.id) {
    throw new Error('send-network-mismatch');
  }
  if (account.identityKind !== 'classic') {
    throw new Error('send-requires-classic-account');
  }
}

function validateAsset(asset: PaymentReviewAsset): PaymentReviewAsset {
  if (asset.kind === 'native') {
    return asset;
  }

  if (!asset.code || !StrKey.isValidEd25519PublicKey(asset.issuer)) {
    throw new Error('invalid-stellar-asset');
  }
  return asset;
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
