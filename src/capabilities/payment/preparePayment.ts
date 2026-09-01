import {StrKey} from '@stellar/stellar-sdk';

import {APP_CONFIG} from '../../app/config/appConfig';
import type {AccountRecord} from '../account/types';
import type {StellarGateway} from '../../platform/stellar/StellarGateway';
import type {
  StellarAccountState,
  StellarNativeBalance,
  StellarTrustlineBalance,
} from '../../platform/stellar/types';
import {
  buildPaymentReview,
  type PaymentReview,
  type PaymentReviewAsset,
} from './buildPaymentReview';

const MAX_STELLAR_AMOUNT_STROOPS = 9_223_372_036_854_775_807n;
const MAX_TEXT_MEMO_BYTES = 28;

export type PreparePaymentDependencies = Readonly<{
  gateway: StellarGateway;
}>;

export type PaymentRequest = Readonly<{
  destination: string;
  amount: string;
  asset: PaymentReviewAsset;
  memo?: string;
}>;

export async function preparePayment(
  dependencies: PreparePaymentDependencies,
  account: AccountRecord,
  request: PaymentRequest,
): Promise<PaymentReview> {
  assertClassicSource(account);
  const destination = validateClassicDestination(request.destination);
  const amount = validatePaymentAmount(request.amount);
  const amountStroops = parsePositiveStroops(amount);
  const asset = validatePaymentAsset(request.asset);
  const memo = validatePaymentTextMemo(request.memo ?? '');

  const sourceResult = await dependencies.gateway.loadAccountState(account.address);
  if (sourceResult.status !== 'active') {
    throw new Error('payment-source-account-inactive');
  }
  if (sourceResult.account.address !== account.address) {
    throw new Error('payment-source-account-mismatch');
  }

  const destinationResult = await dependencies.gateway.loadAccountState(destination);
  const ledger = await dependencies.gateway.loadLedgerParameters();

  validateSourceAvailability(
    sourceResult.account,
    account.address,
    asset,
    amountStroops,
    ledger.baseReserveStroops,
    ledger.baseFeeStroops,
  );

  let operation: 'payment' | 'create-account';
  if (destinationResult.status === 'inactive') {
    operation = 'create-account';
    if (asset.kind !== 'native') {
      throw new Error('payment-issued-asset-requires-existing-destination');
    }
    const minimumStartingBalance = BigInt(ledger.baseReserveStroops) * 2n;
    if (amountStroops < minimumStartingBalance) {
      throw new Error('payment-create-account-below-minimum-balance');
    }
  } else {
    operation = 'payment';
    const destinationAccount = destinationResult.account;
    if (destinationAccount.address !== destination) {
      throw new Error('payment-destination-account-mismatch');
    }
    validateDestinationCapacity(
      destinationAccount,
      destination,
      asset,
      amountStroops,
    );
    if (memo === undefined && destinationAccount.memoRequired) {
      throw new Error('payment-destination-requires-memo');
    }
  }

  const built = await dependencies.gateway.buildPayment({
    operation,
    source: account.address,
    destination,
    asset,
    amount,
    ...(memo === undefined ? {} : {memo}),
    baseFee: String(ledger.baseFeeStroops),
  });
  if (built.source !== account.address || built.networkId !== account.networkId) {
    throw new Error('payment-built-transaction-context-mismatch');
  }

  const review = buildPaymentReview({
    transactionXdrBase64: built.transactionXdrBase64,
    networkId: built.networkId,
  });
  if (
    review.source !== account.address ||
    review.destination !== destination ||
    review.operation !== operation ||
    review.amount !== canonicalAmount(amountStroops) ||
    !sameAsset(review.asset, asset)
  ) {
    throw new Error('payment-review-context-mismatch');
  }
  return review;
}

export function validateClassicDestination(value: string): string {
  const destination = value.trim();
  if (!StrKey.isValidEd25519PublicKey(destination)) {
    throw new Error('invalid-stellar-destination');
  }
  return destination;
}

export function validatePaymentAmount(value: string): string {
  const amount = value.trim();
  parsePositiveStroops(amount);
  return amount;
}

export function validatePaymentAsset(asset: PaymentReviewAsset): PaymentReviewAsset {
  if (asset.kind === 'native') {
    return asset;
  }
  if (!/^[A-Za-z0-9]{1,12}$/.test(asset.code)) {
    throw new Error('invalid-stellar-asset-code');
  }
  if (!StrKey.isValidEd25519PublicKey(asset.issuer)) {
    throw new Error('invalid-stellar-asset-issuer');
  }
  return asset;
}

export function validatePaymentTextMemo(value: string): string | undefined {
  if (value.length === 0) {
    return undefined;
  }
  if (utf8ByteLength(value) > MAX_TEXT_MEMO_BYTES) {
    throw new Error('payment-memo-too-long');
  }
  return value;
}

function assertClassicSource(account: AccountRecord): void {
  if (account.networkId !== APP_CONFIG.network.id) {
    throw new Error('send-network-mismatch');
  }
  if (account.identityKind !== 'classic') {
    throw new Error('send-requires-classic-account');
  }
}

function validateSourceAvailability(
  account: StellarAccountState,
  sourceAddress: string,
  asset: PaymentReviewAsset,
  amount: bigint,
  baseReserveStroops: number,
  baseFeeStroops: number,
): void {
  assertLedgerParameters(baseReserveStroops, baseFeeStroops);

  if (asset.kind === 'credit' && asset.issuer === sourceAddress) {
    ensureNativeFeeCapacity(account, baseReserveStroops, baseFeeStroops);
    return;
  }

  if (asset.kind === 'native') {
    const native = findNative(account);
    const available = native
      ? maxZero(
          parseStroops(native.balance) -
            parseStroops(native.sellingLiabilities) -
            minimumBalance(account, baseReserveStroops) -
            BigInt(baseFeeStroops),
        )
      : 0n;
    if (amount > available) {
      throw new Error('payment-insufficient-source-balance');
    }
    return;
  }

  const trustline = findTrustline(account, asset);
  if (!trustline) {
    throw new Error('payment-source-trustline-missing');
  }
  if (!trustline.isAuthorized) {
    throw new Error('payment-source-trustline-not-authorized');
  }
  ensureNativeFeeCapacity(account, baseReserveStroops, baseFeeStroops);
  const available = maxZero(
    parseStroops(trustline.balance) - parseStroops(trustline.sellingLiabilities),
  );
  if (amount > available) {
    throw new Error('payment-insufficient-source-balance');
  }
}

function validateDestinationCapacity(
  account: StellarAccountState,
  destinationAddress: string,
  asset: PaymentReviewAsset,
  amount: bigint,
): void {
  if (asset.kind === 'credit' && asset.issuer === destinationAddress) {
    return;
  }

  if (asset.kind === 'native') {
    const native = findNative(account);
    if (!native) {
      throw new Error('payment-destination-native-balance-missing');
    }
    const committed =
      parseStroops(native.balance) + parseStroops(native.buyingLiabilities ?? '0');
    if (amount > maxZero(MAX_STELLAR_AMOUNT_STROOPS - committed)) {
      throw new Error('payment-destination-insufficient-capacity');
    }
    return;
  }

  const trustline = findTrustline(account, asset);
  if (!trustline) {
    throw new Error('payment-destination-trustline-missing');
  }
  if (!trustline.isAuthorized) {
    throw new Error('payment-destination-trustline-not-authorized');
  }
  if (trustline.limit === undefined) {
    throw new Error('payment-destination-trustline-limit-missing');
  }
  const committed =
    parseStroops(trustline.balance) + parseStroops(trustline.buyingLiabilities);
  const capacity = maxZero(parseStroops(trustline.limit) - committed);
  if (amount > capacity) {
    throw new Error('payment-destination-insufficient-capacity');
  }
}

function ensureNativeFeeCapacity(
  account: StellarAccountState,
  baseReserveStroops: number,
  baseFeeStroops: number,
): void {
  const native = findNative(account);
  if (!native) {
    throw new Error('payment-insufficient-xlm-for-fee');
  }
  const free = maxZero(
    parseStroops(native.balance) -
      parseStroops(native.sellingLiabilities) -
      minimumBalance(account, baseReserveStroops),
  );
  if (free < BigInt(baseFeeStroops)) {
    throw new Error('payment-insufficient-xlm-for-fee');
  }
}

function minimumBalance(account: StellarAccountState, baseReserveStroops: number): bigint {
  const reserveUnits = Math.max(
    0,
    2 + account.subentryCount + account.numSponsoring - account.numSponsored,
  );
  return BigInt(reserveUnits) * BigInt(baseReserveStroops);
}

function findNative(account: StellarAccountState): StellarNativeBalance | undefined {
  return account.balances.find(
    (balance): balance is StellarNativeBalance => balance.kind === 'native',
  );
}

function findTrustline(
  account: StellarAccountState,
  asset: Extract<PaymentReviewAsset, {kind: 'credit'}>,
): StellarTrustlineBalance | undefined {
  return account.balances.find(
    (balance): balance is StellarTrustlineBalance =>
      balance.kind === 'credit' &&
      balance.code === asset.code &&
      balance.issuer === asset.issuer,
  );
}

function assertLedgerParameters(baseReserveStroops: number, baseFeeStroops: number): void {
  if (
    !Number.isSafeInteger(baseReserveStroops) ||
    baseReserveStroops < 0 ||
    !Number.isSafeInteger(baseFeeStroops) ||
    baseFeeStroops < 0
  ) {
    throw new Error('invalid-ledger-reserve-or-fee');
  }
}

function parsePositiveStroops(value: string): bigint {
  const stroops = parseStroops(value);
  if (stroops <= 0n) {
    throw new Error('invalid-stellar-amount');
  }
  return stroops;
}

function parseStroops(value: string): bigint {
  const normalized = value.trim();
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,7}))?$/.exec(normalized);
  if (!match) {
    throw new Error('invalid-stellar-amount');
  }
  const whole = BigInt(match[1]);
  const fraction = BigInt((match[2] ?? '').padEnd(7, '0') || '0');
  const stroops = whole * 10_000_000n + fraction;
  if (stroops > MAX_STELLAR_AMOUNT_STROOPS) {
    throw new Error('invalid-stellar-amount');
  }
  return stroops;
}

function canonicalAmount(stroops: bigint): string {
  const whole = stroops / 10_000_000n;
  const fraction = (stroops % 10_000_000n).toString().padStart(7, '0');
  return `${whole}.${fraction}`;
}

function sameAsset(left: PaymentReviewAsset, right: PaymentReviewAsset): boolean {
  return left.kind === 'native'
    ? right.kind === 'native'
    : right.kind === 'credit' && left.code === right.code && left.issuer === right.issuer;
}

function maxZero(value: bigint): bigint {
  return value > 0n ? value : 0n;
}

function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0)!;
    bytes +=
      codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;
  }
  return bytes;
}
