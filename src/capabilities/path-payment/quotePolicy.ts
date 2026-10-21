import type { StellarPaymentAsset } from '../stellar/types';
import type { PathPaymentQuote, PathPaymentQuoteClock, PathPaymentQuoteProtection } from './types';

const STROOPS_PER_UNIT = 10_000_000n;
const MAX_STELLAR_STROOPS = 9_223_372_036_854_775_807n;
const BPS_DENOMINATOR = 10_000n;
const MAX_SLIPPAGE_BPS = 1_000;
const MAX_QUOTE_TTL_MS = 30_000;

// Return an existing quote, never a re-created route; the first original
// candidate wins a completely identical tie.
export function selectBestPathPaymentQuote(quotes: readonly PathPaymentQuote[]): PathPaymentQuote {
  if (quotes.length === 0) {
    throw new Error('route_unavailable');
  }
  const first = quotes[0];
  if (!first || (first.request.mode !== 'strict_send' && first.request.mode !== 'strict_receive')) {
    throw new Error('invalid_request');
  }
  let best = first;
  for (const candidate of quotes) {
    // Provider responses fetched together by Swap-A share one canonical request snapshot.
    // Never rank quotes from different requests, networks, accounts, or modes together.
    if (!candidate || candidate.request !== first.request) {
      throw new Error('invalid_request');
    }
    assertFixedSide(candidate);
    if (compareQuotePriority(candidate, best) < 0) {
      best = candidate;
    }
  }
  return best;
}

// Produces review-bound, value-only limits. Swap-C must call this at the point
// of preparation; it does not build, sign, or submit a transaction itself.
export function derivePathPaymentProtection(
  quote: PathPaymentQuote,
  slippageBps: number,
  clock: PathPaymentQuoteClock,
): PathPaymentQuoteProtection {
  if (!Number.isInteger(slippageBps) || slippageBps < 0 || slippageBps > MAX_SLIPPAGE_BPS) {
    throw new Error('slippage_out_of_range');
  }
  assertQuoteFresh(quote, clock);
  assertFixedSide(quote);
  const bps = BigInt(slippageBps);
  if (quote.request.mode === 'strict_send') {
    const destination = parsePositiveStroops(quote.destinationAmount);
    const destinationMinimum = (destination * (BPS_DENOMINATOR - bps)) / BPS_DENOMINATOR;
    return Object.freeze({
      mode: 'strict_send',
      quote,
      slippageBps,
      destinationMinimum: checkedAmount(destinationMinimum),
    });
  }
  if (quote.request.mode === 'strict_receive') {
    const source = parsePositiveStroops(quote.sourceAmount);
    const numerator = source * (BPS_DENOMINATOR + bps);
    const sourceMaximum = (numerator + BPS_DENOMINATOR - 1n) / BPS_DENOMINATOR;
    return Object.freeze({
      mode: 'strict_receive',
      quote,
      slippageBps,
      sourceMaximum: checkedAmount(sourceMaximum),
    });
  }
  throw new Error('invalid_request');
}

function assertQuoteFresh(quote: PathPaymentQuote, clock: PathPaymentQuoteClock): void {
  const { quotedAtUnixMs, expiresAtUnixMs, quotedAtMonotonicMs } = quote;
  const nowUnixMs = clock.nowUnixMs();
  const nowMonotonicMs = clock.nowMonotonicMs();
  const windowMs = expiresAtUnixMs - quotedAtUnixMs;
  if (
    !Number.isSafeInteger(quotedAtUnixMs) ||
    !Number.isSafeInteger(expiresAtUnixMs) ||
    !Number.isFinite(quotedAtMonotonicMs) ||
    !Number.isSafeInteger(nowUnixMs) ||
    !Number.isFinite(nowMonotonicMs) ||
    quotedAtUnixMs < 0 ||
    quotedAtMonotonicMs < 0 ||
    nowUnixMs < 0 ||
    nowMonotonicMs < quotedAtMonotonicMs ||
    windowMs <= 0 ||
    windowMs > MAX_QUOTE_TTL_MS ||
    nowUnixMs >= expiresAtUnixMs ||
    nowMonotonicMs - quotedAtMonotonicMs >= windowMs
  ) {
    throw new Error('quote_expired');
  }
}

function assertFixedSide(quote: PathPaymentQuote): void {
  const fixed = parsePositiveStroops(quote.request.fixedAmount);
  if (
    (quote.request.mode === 'strict_send' && parsePositiveStroops(quote.sourceAmount) !== fixed) ||
    (quote.request.mode === 'strict_receive' && parsePositiveStroops(quote.destinationAmount) !== fixed)
  ) {
    throw new Error('quote_unavailable');
  }
}

function compareQuotePriority(left: PathPaymentQuote, right: PathPaymentQuote): number {
  const strictSend = left.request.mode === 'strict_send';
  const first = parsePositiveStroops(strictSend ? left.destinationAmount : left.sourceAmount);
  const second = parsePositiveStroops(strictSend ? right.destinationAmount : right.sourceAmount);
  if (first !== second) {
    return strictSend ? (first > second ? -1 : 1) : first < second ? -1 : 1;
  }
  if (left.path.length !== right.path.length) {
    return left.path.length < right.path.length ? -1 : 1;
  }
  const a = pathIdentity(left.path);
  const b = pathIdentity(right.path);
  return a === b ? 0 : a < b ? -1 : 1;
}

function pathIdentity(path: readonly StellarPaymentAsset[]): string {
  return path.map(asset => (asset.kind === 'native' ? 'XLM' : asset.code + ':' + asset.issuer)).join(',');
}

function parsePositiveStroops(value: string): bigint {
  if (typeof value !== 'string' || value.length > 20) throw new Error('quote_unavailable');
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,7}))?$/.exec(value);
  if (!match) throw new Error('quote_unavailable');
  const result = BigInt(match[1]) * STROOPS_PER_UNIT + BigInt((match[2] ?? '').padEnd(7, '0') || '0');
  if (result <= 0n || result > MAX_STELLAR_STROOPS) throw new Error('quote_unavailable');
  return result;
}

function checkedAmount(stroops: bigint): string {
  if (stroops <= 0n || stroops > MAX_STELLAR_STROOPS) {
    throw new Error('slippage_exceeded');
  }
  return (stroops / STROOPS_PER_UNIT).toString() + '.' + (stroops % STROOPS_PER_UNIT).toString().padStart(7, '0');
}
