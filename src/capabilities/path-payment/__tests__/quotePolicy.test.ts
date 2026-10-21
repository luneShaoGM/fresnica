import type { StellarPaymentAsset } from '../../stellar/types';
import { derivePathPaymentProtection, selectBestPathPaymentQuote } from '../quotePolicy';
import type { PathPaymentMode, PathPaymentQuote, PathPaymentQuoteRequest } from '../types';

type SelectionVector = Readonly<{
  name: string;
  mode: PathPaymentMode;
  candidates: readonly Readonly<{
    source: string;
    destination: string;
    path: readonly string[];
  }>[];
  expected_index: number;
}>;
type SlippageVector = Readonly<{
  name: string;
  mode: PathPaymentMode;
  quoted_destination?: string;
  quoted_source?: string;
  slippage_bps: number;
  expected_destination_min?: string;
  expected_source_max?: string;
  expected_error?: string;
}>;
const official = require('../../../../spec/test-vectors/path-payment-v1.json') as {
  schema: string;
  quote_ttl: {
    maximum_seconds: number;
    expires_when_now_equals_expires_at: boolean;
    monotonic_elapsed_time_is_authoritative_when_available: boolean;
    expiry_gates_preparation: boolean;
    prepared_transaction_uses_transaction_capability_timebounds: boolean;
  };
  selection: readonly SelectionVector[];
  slippage: readonly SlippageVector[];
};
const NOW = 1_782_000_000_000;
const MONOTONIC = 20_000;
const NATIVE = Object.freeze({ kind: 'native' as const });
const CREDIT = Object.freeze({ kind: 'credit' as const, code: 'USDC', issuer: 'GISSUER' });
const REQUEST = Object.freeze({
  network: { id: 'stellar-testnet', networkPassphrase: 'Test SDF Network ; September 2015' },
  source: 'GSOURCE',
  destination: 'GSOURCE',
  sourceAsset: NATIVE,
  destinationAsset: CREDIT,
  mode: 'strict_send' as const,
  fixedAmount: '5',
});
function asset(value: string): StellarPaymentAsset {
  if (value === 'XLM') return NATIVE;
  const [code, issuer] = value.split(':');
  if (!code || !issuer) throw new Error('invalid test asset');
  return { kind: 'credit', code, issuer };
}
function quote(
  sourceAmount: string,
  destinationAmount: string,
  path: readonly StellarPaymentAsset[] = [],
  request: PathPaymentQuoteRequest = REQUEST,
  overrides: Partial<PathPaymentQuote> = {},
): PathPaymentQuote {
  return Object.freeze({
    request,
    sourceAmount,
    destinationAmount,
    path: Object.freeze([...path]),
    quotedAtUnixMs: NOW,
    expiresAtUnixMs: NOW + 30_000,
    quotedAtMonotonicMs: MONOTONIC,
    ...overrides,
  });
}
function clock(wall = NOW, mono = MONOTONIC) {
  return { nowUnixMs: () => wall, nowMonotonicMs: () => mono };
}
function canonical(amount: string): string {
  const [integer, fraction = ''] = amount.split('.');
  return integer + '.' + fraction.padEnd(7, '0');
}

describe('Swap-B deterministic candidate selection', () => {
  it.each(official.selection)('passes Normative vector: $name', vector => {
    const request: PathPaymentQuoteRequest = Object.freeze({
      ...REQUEST,
      mode: vector.mode,
      fixedAmount: vector.mode === 'strict_send' ? vector.candidates[0].source : vector.candidates[0].destination,
    });
    const quotes = vector.candidates.map(candidate =>
      quote(candidate.source, candidate.destination, candidate.path.map(asset), request),
    );
    expect(quotes.indexOf(selectBestPathPaymentQuote(quotes))).toBe(vector.expected_index);
  });

  it('breaks full ties by canonical lexical path identity, independent of provider order', () => {
    const quotes = [quote('5', '10', [asset('USD:GISSUER')]), quote('5', '10', [asset('EUR:GISSUER')])];
    expect(selectBestPathPaymentQuote(quotes)).toBe(quotes[1]);
  });

  it('keeps first provider candidate on a full tie without mutating input', () => {
    const quotes = Object.freeze([quote('5', '10'), quote('5.0000000', '10.0000000')]);
    expect(selectBestPathPaymentQuote(quotes)).toBe(quotes[0]);
  });

  it('fails closed on missing candidates and mixed request identity', () => {
    expect(() => selectBestPathPaymentQuote([])).toThrow('route_unavailable');
    expect(() =>
      selectBestPathPaymentQuote([quote('5', '10'), quote('5', '11', [], { ...REQUEST, destination: 'GOTHER' })]),
    ).toThrow('invalid_request');
  });

  it('rejects even a single forged quote whose fixed side differs from its request', () => {
    expect(() => selectBestPathPaymentQuote([quote('4', '10')])).toThrow('quote_unavailable');
    expect(() => derivePathPaymentProtection(quote('4', '10'), 100, clock())).toThrow('quote_unavailable');
    const receive = { ...REQUEST, mode: 'strict_receive' as const, fixedAmount: '10' };
    expect(() => selectBestPathPaymentQuote([quote('5', '9', [], receive)])).toThrow('quote_unavailable');
    expect(() => derivePathPaymentProtection(quote('5', '9', [], receive), 100, clock())).toThrow('quote_unavailable');
  });

  it('compares the full signed-i64 stroops, never rounded JS floats', () => {
    const quotes = [quote('5', '922337203685.4775806'), quote('5', '922337203685.4775807')];
    expect(selectBestPathPaymentQuote(quotes)).toBe(quotes[1]);
  });
});

describe('Swap-B quote expiry and integer slippage boundary', () => {
  it.each(official.slippage)('passes Normative slippage vector: $name', vector => {
    const request: PathPaymentQuoteRequest = {
      ...REQUEST,
      mode: vector.mode,
      fixedAmount: vector.mode === 'strict_send' ? '5' : '10',
    };
    const candidate = quote(
      vector.mode === 'strict_send' ? '5' : (vector.quoted_source ?? '3'),
      vector.mode === 'strict_send' ? (vector.quoted_destination ?? '5') : '10',
      [],
      request,
    );
    if (vector.expected_error) {
      expect(() => derivePathPaymentProtection(candidate, vector.slippage_bps, clock())).toThrow(vector.expected_error);
    } else {
      const protection = derivePathPaymentProtection(candidate, vector.slippage_bps, clock());
      if (protection.mode === 'strict_send') {
        expect(protection.destinationMinimum).toBe(canonical(vector.expected_destination_min as string));
      } else {
        expect(protection.sourceMaximum).toBe(canonical(vector.expected_source_max as string));
      }
      expect(protection.quote).toBe(candidate);
      expect(protection.slippageBps).toBe(vector.slippage_bps);
    }
  });

  it('expires at the exact 30-second boundary (wall OR monotonic)', () => {
    expect(official.quote_ttl.maximum_seconds).toBe(30);
    expect(official.quote_ttl.expires_when_now_equals_expires_at).toBe(true);
    expect(official.quote_ttl.expiry_gates_preparation).toBe(true);
    expect(official.quote_ttl.prepared_transaction_uses_transaction_capability_timebounds).toBe(true);
    expect(() =>
      derivePathPaymentProtection(quote('5', '10'), 100, clock(NOW + 29_999, MONOTONIC + 29_999)),
    ).not.toThrow();
    expect(() => derivePathPaymentProtection(quote('5', '10'), 100, clock(NOW + 30_000, MONOTONIC + 29_999))).toThrow(
      'quote_expired',
    );
    expect(() => derivePathPaymentProtection(quote('5', '10'), 100, clock(NOW + 29_999, MONOTONIC + 30_000))).toThrow(
      'quote_expired',
    );
  });

  it('does not extend a quote with a malformed receipt snapshot', () => {
    expect(() =>
      derivePathPaymentProtection(quote('5', '10', [], REQUEST, { quotedAtMonotonicMs: Number.NaN }), 100, clock()),
    ).toThrow('quote_expired');
    expect(() =>
      derivePathPaymentProtection(quote('5', '10', [], REQUEST, { expiresAtUnixMs: NOW }), 100, clock()),
    ).toThrow('quote_expired');
  });

  it('clock rollback cannot extend quote life; monotonic reset/NaN fails closed', () => {
    expect(official.quote_ttl.monotonic_elapsed_time_is_authoritative_when_available).toBe(true);
    expect(() => derivePathPaymentProtection(quote('5', '10'), 100, clock(NOW - 5_000, MONOTONIC + 30_000))).toThrow(
      'quote_expired',
    );
    expect(() =>
      derivePathPaymentProtection(quote('5', '10'), 100, clock(NOW - 5_000, MONOTONIC + 1_000)),
    ).not.toThrow();
    expect(() => derivePathPaymentProtection(quote('5', '10'), 100, clock(NOW, MONOTONIC - 1))).toThrow(
      'quote_expired',
    );
    expect(() => derivePathPaymentProtection(quote('5', '10'), 100, clock(NOW, Number.NaN))).toThrow('quote_expired');
  });

  it('enforces an earlier recorded expiry and rejects a 30-second extension', () => {
    const short = quote('5', '10', [], REQUEST, { expiresAtUnixMs: NOW + 5_000 });
    expect(() => derivePathPaymentProtection(short, 100, clock(NOW + 4_999, MONOTONIC + 4_999))).not.toThrow();
    expect(() => derivePathPaymentProtection(short, 100, clock(NOW - 100_000, MONOTONIC + 5_000))).toThrow(
      'quote_expired',
    );
    const tampered = quote('5', '10', [], REQUEST, { expiresAtUnixMs: NOW + 35_000 });
    expect(() => derivePathPaymentProtection(tampered, 100, clock(NOW, MONOTONIC))).toThrow('quote_expired');
  });

  it.each([-1, 1001, Number.NaN, 1.5, Number.POSITIVE_INFINITY])('rejects invalid explicit slippage %s', bps => {
    expect(() => derivePathPaymentProtection(quote('5', '10'), bps, clock())).toThrow('slippage_out_of_range');
  });

  it('rejects floor-to-zero or overflow above signed i64', () => {
    expect(() => derivePathPaymentProtection(quote('5', '0.0000001'), 1000, clock())).toThrow('slippage_exceeded');
    const maximum = '922337203685.4775807';
    expect(() =>
      derivePathPaymentProtection(
        quote(maximum, '10', [], { ...REQUEST, mode: 'strict_receive', fixedAmount: '10' }),
        1,
        clock(),
      ),
    ).toThrow('slippage_exceeded');
  });

  it('returns the exact original selected quote and no prepared XDR', () => {
    const candidate = quote('5', '10', [asset('XLM')]);
    const protection = derivePathPaymentProtection(candidate, 25, clock());
    expect(Object.isFrozen(protection)).toBe(true);
    expect(protection).toMatchObject({
      mode: 'strict_send',
      quote: candidate,
      destinationMinimum: '9.9750000',
      slippageBps: 25,
    });
    expect(protection).not.toHaveProperty('transactionXdrBase64');
  });
});
