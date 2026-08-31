import {StrKey} from '@stellar/stellar-sdk';

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
  submitReviewedPayment,
  type SubmitReviewedPaymentResult,
} from '../../capabilities/payment/submitReviewedPayment';
import type {SignerRecord} from '../../capabilities/signer/types';
import type {FresnicaSdk} from '../../platform/fresnica/FresnicaSdk';
import type {StellarGateway} from '../../platform/stellar/StellarGateway';

const DEFAULT_BASE_FEE_STROOPS = '100';
const MAX_STELLAR_AMOUNT_STROOPS = 9_223_372_036_854_775_807n;
const MAX_TEXT_MEMO_BYTES = 28;

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
  const memo = validateTextMemo(draft.memo ?? '');

  const built = await dependencies.gateway.buildPayment({
    source: account.address,
    destination,
    asset,
    amount,
    ...(memo === undefined ? {} : {memo}),
    baseFee: DEFAULT_BASE_FEE_STROOPS,
  });

  if (built.source !== account.address || built.networkId !== account.networkId) {
    throw new Error('send-built-transaction-context-mismatch');
  }

  const review = buildPaymentReview({
    transactionXdrBase64: built.transactionXdrBase64,
    networkId: built.networkId,
  });
  if (review.source !== account.address) {
    throw new Error('send-review-account-mismatch');
  }
  return review;
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
    systemAuthReason: `Send ${exactReview.amount} ${assetCode(exactReview.asset)}`,
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

export function sendAssetKey(asset: BalanceAsset | PaymentReviewAsset): string {
  return asset.kind === 'native' ? 'XLM' : `${asset.code}:${asset.issuer}`;
}

export function validateTextMemo(value: string): string | undefined {
  const memo = value.trim();
  if (memo.length === 0) {
    return undefined;
  }
  if (utf8ByteLength(memo) > MAX_TEXT_MEMO_BYTES) {
    throw new Error('payment-memo-too-long');
  }
  return memo;
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

function assetCode(asset: PaymentReviewAsset): string {
  return asset.kind === 'native' ? 'XLM' : asset.code;
}

function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0)!;
    if (codePoint <= 0x7f) {
      bytes += 1;
    } else if (codePoint <= 0x7ff) {
      bytes += 2;
    } else if (codePoint <= 0xffff) {
      bytes += 3;
    } else {
      bytes += 4;
    }
  }
  return bytes;
}
