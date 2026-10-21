import type { AccountRecord } from '../account/types';
import { validatePaymentAsset } from '../payment/preparePayment';
import type { StellarPaymentAsset, StellarPaymentMemo } from '../stellar/types';
import { assertPathPaymentPreflight } from './preflightPathPayment';
import { derivePathPaymentProtection } from './quotePolicy';
import type {
  PathPaymentPrepareOptions,
  PathPaymentQuote,
  PathPaymentTransactionProjection,
  PreparedPathPaymentReview,
  PreparePathPaymentDependencies,
} from './types';

// Prepares one unsigned, independently inspected transaction for exactly one
// selected quote. It does not expose a signer, authorization or submit port.
export async function preparePathPayment(
  dependencies: PreparePathPaymentDependencies,
  wallet: Pick<AccountRecord, 'address' | 'networkId' | 'identityKind'>,
  quote: PathPaymentQuote,
  options: PathPaymentPrepareOptions,
): Promise<PreparedPathPaymentReview> {
  const { feeStroops, slippageBps, transactionTimeoutSeconds } = options;
  if (
    !Number.isSafeInteger(feeStroops) ||
    feeStroops <= 0 ||
    !Number.isSafeInteger(transactionTimeoutSeconds) ||
    transactionTimeoutSeconds < 1 ||
    transactionTimeoutSeconds > 3600
  ) {
    throw new Error('invalid_request');
  }
  assertContext(dependencies, wallet, quote);
  assertPathIsValid(dependencies, quote);
  const fingerprint = requestFingerprint(quote);
  const assertOriginalOptions = () => {
    if (
      options.feeStroops !== feeStroops ||
      options.slippageBps !== slippageBps ||
      options.transactionTimeoutSeconds !== transactionTimeoutSeconds
    ) {
      throw new Error('invalid_request');
    }
  };
  const firstProtection = derivePathPaymentProtection(quote, slippageBps, dependencies.preflight.clock);
  await assertPathPaymentPreflight(dependencies.preflight, wallet, quote, slippageBps, feeStroops);
  assertContext(dependencies, wallet, quote);
  assertUnchanged(quote, fingerprint);
  assertOriginalOptions();

  const wallTimeMs = dependencies.preflight.clock.nowUnixMs();
  if (!Number.isSafeInteger(wallTimeMs) || wallTimeMs < 0) throw new Error('invalid_request');
  const expiresAtUnixSeconds = Math.floor(wallTimeMs / 1000) + transactionTimeoutSeconds;
  if (!Number.isSafeInteger(expiresAtUnixSeconds) || expiresAtUnixSeconds <= 0) {
    throw new Error('invalid_request');
  }
  const { request } = quote;
  const common = {
    source: request.source,
    destination: request.destination,
    sendAsset: request.sourceAsset,
    destinationAsset: request.destinationAsset,
    path: quote.path,
    ...(request.memo === undefined ? {} : { memo: request.memo }),
    baseFee: String(feeStroops),
    expiresAtUnixSeconds,
  };
  let built;
  try {
    built =
      firstProtection.mode === 'strict_send'
        ? await dependencies.transactionGateway.buildPathPaymentStrictSend({
            ...common,
            sendAmount: quote.sourceAmount,
            destinationMinimum: firstProtection.destinationMinimum,
          })
        : await dependencies.transactionGateway.buildPathPaymentStrictReceive({
            ...common,
            sendMaximum: firstProtection.sourceMaximum,
            destinationAmount: quote.destinationAmount,
          });
  } catch {
    throw new Error('quote_unavailable');
  }
  assertContext(dependencies, wallet, quote);
  assertUnchanged(quote, fingerprint);
  assertOriginalOptions();
  if (
    !built ||
    built.source !== request.source ||
    built.networkId !== request.network.id ||
    typeof built.transactionXdrBase64 !== 'string' ||
    built.transactionXdrBase64.length === 0
  ) {
    throw new Error('path_payment_review_mismatch');
  }

  // The builder awaited Horizon's account sequence; it may have consumed the
  // quote's remaining lifetime or observed now-invalid ledger state.
  await assertPathPaymentPreflight(dependencies.preflight, wallet, quote, slippageBps, feeStroops);
  assertContext(dependencies, wallet, quote);
  assertUnchanged(quote, fingerprint);
  assertOriginalOptions();
  const secondProtection = derivePathPaymentProtection(quote, slippageBps, dependencies.preflight.clock);
  if (
    firstProtection.mode !== secondProtection.mode ||
    (firstProtection.mode === 'strict_send' &&
      secondProtection.mode === 'strict_send' &&
      firstProtection.destinationMinimum !== secondProtection.destinationMinimum) ||
    (firstProtection.mode === 'strict_receive' &&
      secondProtection.mode === 'strict_receive' &&
      firstProtection.sourceMaximum !== secondProtection.sourceMaximum)
  ) {
    throw new Error('path_payment_review_mismatch');
  }

  let projection: PathPaymentTransactionProjection;
  try {
    projection = dependencies.transactionGateway.inspectPathPaymentTransaction({
      transactionXdrBase64: built.transactionXdrBase64,
      networkPassphrase: request.network.networkPassphrase,
    });
  } catch {
    throw new Error('path_payment_review_mismatch');
  }
  if (!sameProjection(projection, quote, firstProtection, String(feeStroops), expiresAtUnixSeconds)) {
    throw new Error('path_payment_review_mismatch');
  }
  assertContext(dependencies, wallet, quote);
  assertUnchanged(quote, fingerprint);
  assertOriginalOptions();
  const latestWallMs = dependencies.preflight.clock.nowUnixMs();
  if (!Number.isSafeInteger(latestWallMs) || latestWallMs >= expiresAtUnixSeconds * 1000) {
    throw new Error('path_payment_review_mismatch');
  }
  derivePathPaymentProtection(quote, slippageBps, dependencies.preflight.clock);

  // The caller's structurally readonly quote may still be mutable at runtime.
  // Keep a detached, deeply frozen quote identity beside the reviewed XDR.
  const reviewedQuote = snapshotReviewedQuote(quote);
  const detail = {
    transactionXdrBase64: built.transactionXdrBase64,
    networkId: request.network.id,
    source: request.source,
    destination: request.destination,
    sourceAsset: reviewedQuote.request.sourceAsset,
    destinationAsset: reviewedQuote.request.destinationAsset,
    path: reviewedQuote.path,
    quote: reviewedQuote,
    ...(reviewedQuote.request.memo === undefined ? {} : { memo: reviewedQuote.request.memo }),
    quotedSourceAmount: quote.sourceAmount,
    quotedDestinationAmount: quote.destinationAmount,
    slippageBps: slippageBps,
    fee: String(feeStroops),
    expiresAtUnixSeconds,
  };
  return Object.freeze(
    firstProtection.mode === 'strict_send'
      ? {
          ...detail,
          mode: 'strict_send',
          sendAmount: quote.sourceAmount,
          destinationMinimum: firstProtection.destinationMinimum,
        }
      : {
          ...detail,
          mode: 'strict_receive',
          destinationAmount: quote.destinationAmount,
          sourceMaximum: firstProtection.sourceMaximum,
        },
  ) as PreparedPathPaymentReview;
}

function snapshotReviewedQuote(quote: PathPaymentQuote): PathPaymentQuote {
  const { request } = quote;
  return Object.freeze({
    request: Object.freeze({
      network: Object.freeze({ ...request.network }),
      source: request.source,
      destination: request.destination,
      sourceAsset: Object.freeze({ ...request.sourceAsset }),
      destinationAsset: Object.freeze({ ...request.destinationAsset }),
      mode: request.mode,
      fixedAmount: request.fixedAmount,
      ...(request.memo === undefined ? {} : { memo: Object.freeze({ ...request.memo }) }),
    }),
    sourceAmount: quote.sourceAmount,
    destinationAmount: quote.destinationAmount,
    path: Object.freeze(quote.path.map(asset => Object.freeze({ ...asset }))),
    quotedAtUnixMs: quote.quotedAtUnixMs,
    expiresAtUnixMs: quote.expiresAtUnixMs,
    quotedAtMonotonicMs: quote.quotedAtMonotonicMs,
  });
}

function assertContext(
  dependencies: PreparePathPaymentDependencies,
  wallet: Pick<AccountRecord, 'address' | 'networkId' | 'identityKind'>,
  quote: PathPaymentQuote,
): void {
  const expected = quote.request.network;
  const preflightNetwork = dependencies.preflight.network;
  const accountGateway = dependencies.preflight.gateway.network;
  const transactionNetwork = dependencies.transactionGateway.network;
  if (
    !expected?.id ||
    !expected.networkPassphrase ||
    wallet.identityKind !== 'classic' ||
    wallet.address !== quote.request.source ||
    wallet.networkId !== expected.id ||
    [preflightNetwork, accountGateway, transactionNetwork].some(
      candidate => candidate.id !== expected.id || candidate.networkPassphrase !== expected.networkPassphrase,
    )
  ) {
    throw new Error('invalid_request');
  }
}

function assertPathIsValid(dependencies: PreparePathPaymentDependencies, quote: PathPaymentQuote): void {
  if (!Array.isArray(quote.path) || quote.path.length > 5) throw new Error('invalid_request');
  for (const asset of quote.path) {
    try {
      validatePaymentAsset(asset, address => dependencies.preflight.gateway.isClassicAccountAddress(address));
    } catch {
      throw new Error('invalid_request');
    }
    if (sameAsset(asset, quote.request.sourceAsset) || sameAsset(asset, quote.request.destinationAsset)) {
      throw new Error('invalid_request');
    }
  }
}

function requestFingerprint(quote: PathPaymentQuote): string {
  try {
    return JSON.stringify({
      request: quote.request,
      sourceAmount: quote.sourceAmount,
      destinationAmount: quote.destinationAmount,
      path: quote.path,
      quotedAtUnixMs: quote.quotedAtUnixMs,
      expiresAtUnixMs: quote.expiresAtUnixMs,
      quotedAtMonotonicMs: quote.quotedAtMonotonicMs,
    });
  } catch {
    throw new Error('invalid_request');
  }
}

function assertUnchanged(quote: PathPaymentQuote, initial: string): void {
  if (requestFingerprint(quote) !== initial) throw new Error('invalid_request');
}

function sameAsset(first: StellarPaymentAsset, second: StellarPaymentAsset): boolean {
  return first?.kind === 'native'
    ? second?.kind === 'native'
    : first?.kind === 'credit' &&
        second?.kind === 'credit' &&
        first.code === second.code &&
        first.issuer === second.issuer;
}

function sameMemo(first?: StellarPaymentMemo, second?: StellarPaymentMemo): boolean {
  return first === undefined || second === undefined
    ? first === second
    : first.type === second.type && first.value === second.value;
}

function sameProjection(
  actual: PathPaymentTransactionProjection,
  quote: PathPaymentQuote,
  protection: ReturnType<typeof derivePathPaymentProtection>,
  fee: string,
  expiresAtUnixSeconds: number,
): boolean {
  const request = quote.request;
  if (
    !actual ||
    actual.source !== request.source ||
    actual.destination !== request.destination ||
    actual.fee !== fee ||
    actual.minTimeUnixSeconds !== 0 ||
    actual.expiresAtUnixSeconds !== expiresAtUnixSeconds ||
    !sameAsset(actual.sourceAsset, request.sourceAsset) ||
    !sameAsset(actual.destinationAsset, request.destinationAsset) ||
    !sameMemo(actual.memo, request.memo) ||
    !Array.isArray(actual.path) ||
    actual.path.length !== quote.path.length ||
    !actual.path.every((asset, index) => sameAsset(asset, quote.path[index]))
  ) {
    return false;
  }
  if (protection.mode === 'strict_send') {
    return (
      actual.mode === 'strict_send' &&
      actual.sendAmount === quote.sourceAmount &&
      actual.destinationMinimum === protection.destinationMinimum
    );
  }
  return (
    actual.mode === 'strict_receive' &&
    actual.sendMaximum === protection.sourceMaximum &&
    actual.destinationAmount === quote.destinationAmount
  );
}
