import { validatePaymentAsset, validatePaymentMemo } from '../payment/preparePayment';
import type { StellarPaymentAsset, StellarPaymentMemo } from '../stellar/types';
import type {
  LoadPathPaymentQuotesDependencies,
  PathPaymentQuote,
  PathPaymentQuoteRequest,
  PathPaymentRoute,
} from './types';

const STROOPS_PER_UNIT = 10_000_000n;
const MAX_STELLAR_STROOPS = 9_223_372_036_854_775_807n;
const MAX_INTERMEDIATE_ASSETS = 5;
const MAX_QUOTE_TTL_MS = 30_000;

// Swap-A returns unselected, unprepared quotes. Selection, monotonic expiry and
// transaction slippage enforcement belong to the next Capability slices.
export async function loadPathPaymentQuotes(
  dependencies: LoadPathPaymentQuotesDependencies,
  input: PathPaymentQuoteRequest,
): Promise<readonly PathPaymentQuote[]> {
  assertNetworkIdentity(dependencies, input);
  const request = validateRequest(input, dependencies.isClassicAccountAddress);
  let routes: readonly PathPaymentRoute[];
  try {
    routes =
      request.mode === 'strict_send'
        ? await dependencies.gateway.loadStrictSendPaths({
            sourceAsset: request.sourceAsset,
            sourceAmount: request.fixedAmount,
            destinationAssets: [request.destinationAsset],
          })
        : await dependencies.gateway.loadStrictReceivePaths({
            sourceAssets: [request.sourceAsset],
            destinationAsset: request.destinationAsset,
            destinationAmount: request.fixedAmount,
          });
  } catch {
    throw new Error('quote_unavailable');
  }

  // Account/network context may change while Horizon is pending.
  assertNetworkIdentity(dependencies, request);
  if (!Array.isArray(routes)) {
    throw new Error('quote_unavailable');
  }
  if (routes.length === 0) {
    throw new Error('route_unavailable');
  }
  const quotedAtUnixMs = dependencies.nowUnixMs();
  if (!Number.isSafeInteger(quotedAtUnixMs) || quotedAtUnixMs < 0) {
    throw new Error('quote_unavailable');
  }

  return Object.freeze(
    routes.map(route => validateQuote(route, request, quotedAtUnixMs, dependencies.isClassicAccountAddress)),
  );
}

function validateRequest(
  input: PathPaymentQuoteRequest,
  isClassicAddress: (address: string) => boolean,
): PathPaymentQuoteRequest {
  if (input.mode !== 'strict_send' && input.mode !== 'strict_receive') {
    throw new Error('invalid_request');
  }
  const source = validateAddress(input.source, isClassicAddress);
  const destination = validateAddress(input.destination, isClassicAddress);
  const sourceAsset = validateAsset(input.sourceAsset, isClassicAddress, 'invalid_request');
  const destinationAsset = validateAsset(input.destinationAsset, isClassicAddress, 'invalid_request');
  if (sameAsset(sourceAsset, destinationAsset)) {
    throw new Error('invalid_request');
  }
  const fixedAmount = canonicalPositiveAmount(input.fixedAmount, 'invalid_request');

  let memo: StellarPaymentMemo | undefined;
  try {
    if (
      input.memo !== undefined &&
      input.memo.type !== 'text' &&
      input.memo.type !== 'id' &&
      input.memo.type !== 'hash'
    ) {
      throw new Error('invalid_request');
    }
    memo = validatePaymentMemo(input.memo);
  } catch {
    throw new Error('invalid_request');
  }

  return Object.freeze({
    network: Object.freeze({
      id: input.network.id,
      networkPassphrase: input.network.networkPassphrase,
    }),
    source,
    destination,
    sourceAsset,
    destinationAsset,
    mode: input.mode,
    fixedAmount,
    ...(memo === undefined ? {} : { memo }),
  });
}

function validateQuote(
  route: PathPaymentRoute,
  request: PathPaymentQuoteRequest,
  quotedAtUnixMs: number,
  isClassicAddress: (address: string) => boolean,
): PathPaymentQuote {
  if (!route || !Array.isArray(route.path) || route.path.length > MAX_INTERMEDIATE_ASSETS) {
    throw new Error('quote_unavailable');
  }
  const sourceAsset = validateAsset(route.sourceAsset, isClassicAddress, 'quote_unavailable');
  const destinationAsset = validateAsset(route.destinationAsset, isClassicAddress, 'quote_unavailable');
  const sourceAmount = canonicalPositiveAmount(route.sourceAmount, 'quote_unavailable');
  const destinationAmount = canonicalPositiveAmount(route.destinationAmount, 'quote_unavailable');
  if (
    !sameAsset(sourceAsset, request.sourceAsset) ||
    !sameAsset(destinationAsset, request.destinationAsset) ||
    (request.mode === 'strict_send' && sourceAmount !== request.fixedAmount) ||
    (request.mode === 'strict_receive' && destinationAmount !== request.fixedAmount)
  ) {
    throw new Error('quote_unavailable');
  }

  const path = Object.freeze(route.path.map(asset => validateAsset(asset, isClassicAddress, 'quote_unavailable')));
  if (path.some(asset => sameAsset(asset, request.sourceAsset) || sameAsset(asset, request.destinationAsset))) {
    throw new Error('quote_unavailable');
  }

  return Object.freeze({
    request,
    sourceAmount,
    destinationAmount,
    path,
    quotedAtUnixMs,
    expiresAtUnixMs: quotedAtUnixMs + MAX_QUOTE_TTL_MS,
  });
}

function assertNetworkIdentity(
  dependencies: LoadPathPaymentQuotesDependencies,
  request: PathPaymentQuoteRequest,
): void {
  const current = dependencies.network;
  const gateway = dependencies.gateway.network;
  if (
    !request.network.id ||
    !request.network.networkPassphrase ||
    current.id !== request.network.id ||
    current.networkPassphrase !== request.network.networkPassphrase ||
    gateway.id !== request.network.id ||
    gateway.networkPassphrase !== request.network.networkPassphrase
  ) {
    throw new Error('invalid_request');
  }
}

function validateAddress(value: string, isClassicAddress: (address: string) => boolean): string {
  const address = value.trim();
  if (!isClassicAddress(address)) {
    throw new Error('invalid_request');
  }
  return address;
}

function validateAsset(
  asset: StellarPaymentAsset,
  isClassicAddress: (address: string) => boolean,
  error: string,
): StellarPaymentAsset {
  try {
    const validated = validatePaymentAsset(asset, isClassicAddress);
    return validated.kind === 'native'
      ? Object.freeze({ kind: 'native' })
      : Object.freeze({ kind: 'credit', code: validated.code, issuer: validated.issuer });
  } catch {
    throw new Error(error);
  }
}

function sameAsset(left: StellarPaymentAsset, right: StellarPaymentAsset): boolean {
  return left.kind === 'native'
    ? right.kind === 'native'
    : right.kind === 'credit' && left.code === right.code && left.issuer === right.issuer;
}

function canonicalPositiveAmount(value: string, error: string): string {
  if (typeof value !== 'string') {
    throw new Error(error);
  }
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,7}))?$/.exec(value.trim());
  if (!match) {
    throw new Error(error);
  }
  const stroops = BigInt(match[1]) * STROOPS_PER_UNIT + BigInt((match[2] ?? '').padEnd(7, '0') || '0');
  if (stroops <= 0n || stroops > MAX_STELLAR_STROOPS) {
    throw new Error(error);
  }
  return `${stroops / STROOPS_PER_UNIT}.${(stroops % STROOPS_PER_UNIT).toString().padStart(7, '0')}`;
}
