import type { AccountSignerRepository } from '../account/AccountSignerRepository';
import type { AccountRecord } from '../account/types';
import type { NetworkContext } from '../network/types';
import type { FresnicaSdkPort } from '../ports/FresnicaSdkPort';
import type { SignerRecord } from '../signer/types';
import type { StellarPaymentAsset, StellarPaymentMemo } from '../stellar/types';
import type { TransactionGatewayPort } from '../transaction/TransactionGateway';
import { createTransactionIntentIdentity, type PendingSubmissionDependencies } from '../transaction/pendingSubmission';
import {
  submitReviewedTransaction,
  type SubmitReviewedTransactionResult,
} from '../transaction/submitReviewedTransaction';
import type {
  PreparedPathPaymentReview,
  PathPaymentTransactionGatewayPort,
  PathPaymentTransactionProjection,
} from './types';

type BoundTransactionGateway = TransactionGatewayPort & Readonly<{ network: NetworkContext }>;
export type PathPaymentSubmissionDependencies = Readonly<{
  gateway: BoundTransactionGateway;
  inspector: Pick<PathPaymentTransactionGatewayPort, 'network' | 'inspectPathPaymentTransaction'>;
  sdk: FresnicaSdkPort;
  signerRepository: Pick<AccountSignerRepository, 'listSignersForAccount'>;
  recovery: PendingSubmissionDependencies;
  network: NetworkContext;
  // Required live App selection/route epoch check. D1 account-object and
  // network checks alone cannot detect an external selection switch.
  isCurrentSession: () => boolean;
}>;

type PathPaymentSource = Pick<AccountRecord, 'id' | 'address' | 'networkId' | 'identityKind'>;

// Swap-D1 reuses the shared signing, authorization, pending and reconciliation
// pipeline. No UI entry, signing scheme, broadcast retry or new persistence state.
export async function submitReviewedPathPayment(
  dependencies: PathPaymentSubmissionDependencies,
  account: PathPaymentSource,
  review: PreparedPathPaymentReview,
  signer: SignerRecord,
  appPassphrase?: string,
): Promise<SubmitReviewedTransactionResult> {
  const boundNetwork: NetworkContext = Object.freeze({
    id: dependencies.network.id,
    networkPassphrase: dependencies.network.networkPassphrase,
  });
  const boundAccount: PathPaymentSource = Object.freeze({
    id: account.id,
    address: account.address,
    networkId: account.networkId,
    identityKind: account.identityKind,
  });
  const isCurrentSession = dependencies.isCurrentSession;
  const assertBoundContext = () => {
    let sessionCurrent = false;
    try {
      sessionCurrent = isCurrentSession?.() === true;
    } catch {
      sessionCurrent = false;
    }
    if (
      !sessionCurrent ||
      account.id !== boundAccount.id ||
      account.address !== boundAccount.address ||
      account.networkId !== boundAccount.networkId ||
      account.identityKind !== boundAccount.identityKind
    ) {
      throw new Error('path_payment_review_mismatch');
    }
    for (const candidate of [dependencies.network, dependencies.gateway.network, dependencies.inspector.network]) {
      if (candidate.id !== boundNetwork.id || candidate.networkPassphrase !== boundNetwork.networkPassphrase) {
        throw new Error('path_payment_review_mismatch');
      }
    }
  };
  assertBoundContext();

  let intent: ReturnType<typeof createTransactionIntentIdentity>;
  try {
    validateReviewIdentity(boundAccount, review, boundNetwork);
    const projection = dependencies.inspector.inspectPathPaymentTransaction({
      transactionXdrBase64: review.transactionXdrBase64,
      networkPassphrase: boundNetwork.networkPassphrase,
    });
    validateProjection(review, projection);
    intent = economicIntent(review);
  } catch {
    throw new Error('path_payment_review_mismatch');
  }
  assertBoundContext();

  // The supplied local signer must belong to this specific wallet account.
  // As with S07 Send, watch-only and multi-signer accounts do not fall
  // through to a guess at a signing key.
  const reviewedSigner: SignerRecord = Object.freeze({ ...signer });
  const assertSignerStillAttached = () => {
    const attached = dependencies.signerRepository.listSignersForAccount(boundAccount.id);
    if (
      attached.length !== 1 ||
      attached[0].id !== reviewedSigner.id ||
      attached[0].publicKey !== reviewedSigner.publicKey ||
      attached[0].kind !== reviewedSigner.kind ||
      attached[0].envelopeJson !== reviewedSigner.envelopeJson
    ) {
      throw new Error('path_payment_signer_mismatch');
    }
  };
  try {
    assertSignerStillAttached();
  } catch {
    return { status: 'unsupported-signer' };
  }
  const assertSigningContext = () => {
    assertBoundContext();
    assertSignerStillAttached();
  };
  // Shared signing awaits System Auth availability before entering native
  // signing. Recheck the account after that await, not only after the final
  // signature; otherwise a stale account could be signed in the meantime.
  const guardedSdk: FresnicaSdkPort = {
    ...dependencies.sdk,
    hasSignerSystemAuth: async publicKey => {
      assertSigningContext();
      const available = await dependencies.sdk.hasSignerSystemAuth(publicKey);
      assertSigningContext();
      return available;
    },
    signWithSystemAuth: async request => {
      assertSigningContext();
      const signed = await dependencies.sdk.signWithSystemAuth(request);
      assertSigningContext();
      return signed;
    },
    signWithPassphrase: async request => {
      assertSigningContext();
      const signed = await dependencies.sdk.signWithPassphrase(request);
      assertSigningContext();
      return signed;
    },
  };
  const reviewedTransaction = Object.freeze({
    transactionXdrBase64: review.transactionXdrBase64,
    networkId: boundNetwork.id,
    source: boundAccount.address,
    fee: review.fee,
    expiresAtUnixSeconds: review.expiresAtUnixSeconds,
  });
  const protectedGateway: TransactionGatewayPort = {
    loadAccountAuthorization: async address => {
      assertBoundContext();
      const authorization = await dependencies.gateway.loadAccountAuthorization(address);
      assertBoundContext();
      assertSignerStillAttached();
      if (!authorization || address !== boundAccount.address || authorization.address !== boundAccount.address) {
        throw new Error('path_payment_review_mismatch');
      }
      return authorization;
    },
    transactionHash: signedXdr => {
      assertBoundContext();
      assertSignerStillAttached();
      return dependencies.gateway.transactionHash(signedXdr);
    },
    loadTransactionOutcome: hash => dependencies.gateway.loadTransactionOutcome(hash),
    submitTransaction: async signedXdr => {
      // The shared pipeline already wrote a durable 'submitting' record before
      // this call. Account/network changes or transport errors leave the original
      // transaction unresolved, never a success or an automatic second broadcast.
      const originalHash = dependencies.gateway.transactionHash(signedXdr);
      try {
        assertBoundContext();
        assertSignerStillAttached();
        const result = await dependencies.gateway.submitTransaction(signedXdr);
        assertBoundContext();
        return result;
      } catch {
        return { status: 'uncertain', transactionHash: originalHash };
      }
    },
  };

  return submitReviewedTransaction({
    gateway: protectedGateway,
    sdk: guardedSdk,
    review: reviewedTransaction,
    accountId: boundAccount.id,
    intent,
    recovery: dependencies.recovery,
    signer: reviewedSigner,
    thresholdLevel: 'medium',
    ...(appPassphrase === undefined ? {} : { appPassphrase }),
    systemAuthReason: 'Confirm Path Payment Swap',
    networkPassphrase: boundNetwork.networkPassphrase,
  });
}

function validateReviewIdentity(
  account: PathPaymentSource,
  review: PreparedPathPaymentReview,
  network: NetworkContext,
): void {
  const quote = review.quote;
  const request = quote?.request;
  if (
    !request ||
    account.identityKind !== 'classic' ||
    !account.id ||
    account.networkId !== network.id ||
    review.networkId !== network.id ||
    request.network?.id !== network.id ||
    request.network.networkPassphrase !== network.networkPassphrase ||
    account.address !== request.source ||
    review.source !== account.address ||
    review.destination !== request.destination ||
    review.mode !== request.mode ||
    review.quotedSourceAmount !== quote.sourceAmount ||
    review.quotedDestinationAmount !== quote.destinationAmount ||
    !Array.isArray(quote.path) ||
    quote.path.length > 5 ||
    sameAsset(request.sourceAsset, request.destinationAsset) ||
    quote.path.some(asset => sameAsset(asset, request.sourceAsset) || sameAsset(asset, request.destinationAsset)) ||
    !sameAsset(review.sourceAsset, request.sourceAsset) ||
    !sameAsset(review.destinationAsset, request.destinationAsset) ||
    !sameMemo(review.memo, request.memo) ||
    !samePath(review.path, quote.path) ||
    !review.transactionXdrBase64 ||
    !Number.isSafeInteger(review.expiresAtUnixSeconds) ||
    review.expiresAtUnixSeconds <= 0 ||
    !/^[1-9]\d*$/.test(review.fee)
  ) {
    throw new Error('path_payment_review_mismatch');
  }
  // An already prepared transaction remains valid after its quote expires.
  // Recompute integer bps protection without reapplying quote TTL.
  if (review.mode === 'strict_send') {
    if (
      quote.sourceAmount !== request.fixedAmount ||
      review.sendAmount !== quote.sourceAmount ||
      review.destinationMinimum !== minimumDestination(quote.destinationAmount, review.slippageBps)
    ) {
      throw new Error('path_payment_review_mismatch');
    }
  } else if (review.mode === 'strict_receive') {
    if (
      quote.destinationAmount !== request.fixedAmount ||
      review.destinationAmount !== quote.destinationAmount ||
      review.sourceMaximum !== maximumSource(quote.sourceAmount, review.slippageBps)
    ) {
      throw new Error('path_payment_review_mismatch');
    }
  } else {
    throw new Error('path_payment_review_mismatch');
  }
}

function validateProjection(review: PreparedPathPaymentReview, actual: PathPaymentTransactionProjection): void {
  if (
    !actual ||
    actual.source !== review.source ||
    actual.destination !== review.destination ||
    actual.mode !== review.mode ||
    actual.fee !== review.fee ||
    actual.minTimeUnixSeconds !== 0 ||
    actual.expiresAtUnixSeconds !== review.expiresAtUnixSeconds ||
    !sameAsset(actual.sourceAsset, review.sourceAsset) ||
    !sameAsset(actual.destinationAsset, review.destinationAsset) ||
    !sameMemo(actual.memo, review.memo) ||
    !samePath(actual.path, review.path)
  ) {
    throw new Error('path_payment_review_mismatch');
  }
  if (review.mode === 'strict_send') {
    if (
      actual.mode !== 'strict_send' ||
      actual.sendAmount !== review.sendAmount ||
      actual.destinationMinimum !== review.destinationMinimum
    )
      throw new Error('path_payment_review_mismatch');
  } else if (
    actual.mode !== 'strict_receive' ||
    actual.sendMaximum !== review.sourceMaximum ||
    actual.destinationAmount !== review.destinationAmount
  ) {
    throw new Error('path_payment_review_mismatch');
  }
}

function economicIntent(review: PreparedPathPaymentReview) {
  const request = review.quote.request;
  return createTransactionIntentIdentity('path-payment', [
    request.source,
    request.destination,
    request.mode,
    assetKey(request.sourceAsset),
    assetKey(request.destinationAsset),
    request.fixedAmount,
    request.memo === undefined ? 'memo:none' : 'memo:' + request.memo.type,
    request.memo?.value ?? '',
  ]);
}

function sameAsset(left: StellarPaymentAsset, right: StellarPaymentAsset): boolean {
  return left?.kind === 'native'
    ? right?.kind === 'native'
    : left?.kind === 'credit' && right?.kind === 'credit' && left.code === right.code && left.issuer === right.issuer;
}

function sameMemo(left?: StellarPaymentMemo, right?: StellarPaymentMemo): boolean {
  return left === undefined || right === undefined
    ? left === right
    : left.type === right.type && left.value === right.value;
}

function samePath(left: readonly StellarPaymentAsset[], right: readonly StellarPaymentAsset[]): boolean {
  return (
    Array.isArray(left) &&
    Array.isArray(right) &&
    left.length === right.length &&
    left.every((asset, index) => sameAsset(asset, right[index]))
  );
}

function assetKey(asset: StellarPaymentAsset): string {
  return asset.kind === 'native' ? 'native' : 'credit:' + asset.code + ':' + asset.issuer;
}

function stroops(value: string): bigint {
  if (typeof value !== 'string' || value.length > 20) throw new Error('path_payment_review_mismatch');
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,7}))?$/.exec(value);
  if (!match) throw new Error('path_payment_review_mismatch');
  const amount = BigInt(match[1]) * 10_000_000n + BigInt((match[2] ?? '').padEnd(7, '0') || '0');
  if (amount <= 0n || amount > 9_223_372_036_854_775_807n) {
    throw new Error('path_payment_review_mismatch');
  }
  return amount;
}

function bpsValue(value: number): bigint {
  if (!Number.isInteger(value) || value < 0 || value > 1000) {
    throw new Error('path_payment_review_mismatch');
  }
  return BigInt(value);
}

function canonicalAmount(value: bigint): string {
  if (value <= 0n || value > 9_223_372_036_854_775_807n) {
    throw new Error('path_payment_review_mismatch');
  }
  return String(value / 10_000_000n) + '.' + (value % 10_000_000n).toString().padStart(7, '0');
}

function minimumDestination(quoted: string, slippageBps: number): string {
  return canonicalAmount((stroops(quoted) * (10_000n - bpsValue(slippageBps))) / 10_000n);
}

function maximumSource(quoted: string, slippageBps: number): string {
  return canonicalAmount((stroops(quoted) * (10_000n + bpsValue(slippageBps)) + 9_999n) / 10_000n);
}
