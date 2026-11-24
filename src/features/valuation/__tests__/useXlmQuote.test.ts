import { AppState } from 'react-native';
import { useXlmQuote } from '../useXlmQuote';
import { NativeFiatEstimate } from '../NativeFiatEstimate';
import type { FiatCurrency, XlmQuote, XlmQuotePort } from '@capabilities/valuation/xlmQuote';
import { useCreditFiatQuote } from '../useCreditFiatQuote';
import type { CreditAsset, CreditFiatQuote, CreditFiatQuotePort } from '@capabilities/valuation/creditFiatQuote';

type Slot = { value?: unknown; deps?: readonly unknown[]; cleanup?: () => void };
let mockSlots: Slot[] = [];
let mockCursor = 0;
let mockPendingEffects: Array<() => void> = [];
const mockListeners = new Set<(state: string) => void>();
const mockSameDeps = (a: readonly unknown[] | undefined, b: readonly unknown[]) =>
  a !== undefined && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));

jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useState: (initial: unknown) => {
    const index = mockCursor++;
    if (!mockSlots[index]) mockSlots[index] = { value: initial };
    return [
      mockSlots[index].value,
      (value: unknown) => {
        mockSlots[index].value =
          typeof value === 'function' ? (value as (mockPrevious: unknown) => unknown)(mockSlots[index].value) : value;
      },
    ];
  },
  useEffect: (effect: () => (() => void) | undefined, deps: readonly unknown[]) => {
    const index = mockCursor++;
    if (mockSameDeps(mockSlots[index]?.deps, deps)) return;
    const previous = mockSlots[index]?.cleanup;
    mockSlots[index] = { deps };
    mockPendingEffects.push(() => {
      previous?.();
      mockSlots[index].cleanup = effect();
    });
  },
}));

jest.mock('@ui/theme', () => ({
  useThemedStyles: () => ({ hint: {}, compactHint: {} }),
}));
jest.mock('../../../locale', () => ({
  useLocalization: () => ({
    t: (key: string) => key,
    formatNumber: (value: string) => value,
    formatDate: () => 'today',
  }),
}));
jest.mock('react-native', () => ({
  Text: 'Text',
  AppState: {
    currentState: 'active',
    addEventListener: (_event: string, listener: (state: string) => void) => {
      mockListeners.add(listener);
      return { remove: () => mockListeners.delete(listener) };
    },
  },
}));

const makeQuote = (currency: FiatCurrency = 'USD'): XlmQuote => ({
  currency,
  rate: '0.50000000',
  updatedAt: Date.now(),
  source: 'CoinGecko',
});

function source(): XlmQuotePort & { load: jest.Mock } {
  return { load: jest.fn() };
}

function QuoteHarness(
  quoteSource: XlmQuotePort | undefined,
  currency: FiatCurrency = 'USD',
  active = true,
  clearOnError = false,
) {
  mockCursor = 0;
  return useXlmQuote(quoteSource, currency, active, clearOnError);
}

function effects() {
  const callbacks = mockPendingEffects.splice(0);
  callbacks.forEach(fn => fn());
}

function emitAppState(state: 'active' | 'inactive' | 'background') {
  (AppState as { currentState: string }).currentState = state;
  [...mockListeners].forEach(listener => listener(state));
}

async function settle() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-11-20T00:00:00Z'));
  mockSlots = [];
  mockCursor = 0;
  mockPendingEffects = [];
  mockListeners.clear();
  (AppState as { currentState: string }).currentState = 'active';
});

afterEach(() => {
  mockSlots.forEach(slot => slot.cleanup?.());
  mockListeners.clear();
  jest.useRealTimers();
});

it.each(['offline', '429'])(
  'Settings invalidates a previously shown quote on a %s refresh failure and can retry',
  async failure => {
    const quotes = source();
    const first = makeQuote();
    const recovered: XlmQuote = { ...first, rate: '0.60000000' };
    quotes.load.mockResolvedValueOnce(first).mockRejectedValueOnce(new Error(failure)).mockResolvedValueOnce(recovered);

    QuoteHarness(quotes, 'USD', true, true);
    effects();
    await settle();
    expect(QuoteHarness(quotes, 'USD', true, true)).toEqual(first);
    effects();

    jest.advanceTimersByTime(60_000);
    await settle();
    expect(QuoteHarness(quotes, 'USD', true, true)).toBeUndefined();
    effects();

    jest.advanceTimersByTime(60_000);
    await settle();
    expect(QuoteHarness(quotes, 'USD', true, true)).toEqual(recovered);
    effects();
  },
);

it('Settings estimate presents quoteUnavailable after a successful quote and a failed refresh', async () => {
  const quotes = source();
  quotes.load.mockResolvedValueOnce(makeQuote()).mockRejectedValueOnce(new Error('offline'));
  const settingsQuoteTree = () => {
    mockCursor = 0;
    const result = NativeFiatEstimate({ quotes, amount: '1', currency: 'USD', active: true });
    if (!result) throw new Error('Settings estimate must show quote status');
    return result;
  };

  settingsQuoteTree();
  effects();
  await settle();
  expect(settingsQuoteTree().props.children).toContain('≈ 0.50 USD');
  effects();

  jest.advanceTimersByTime(60_000);
  await settle();
  expect(settingsQuoteTree().props.children).toBe('preferences.quoteUnavailable');
  effects();
});

it('Home keeps an unexpired quote on refresh failure while still in the foreground', async () => {
  const quotes = source();
  const first = makeQuote();
  quotes.load.mockResolvedValueOnce(first).mockRejectedValueOnce(new Error('429'));

  QuoteHarness(quotes);
  effects();
  await settle();
  expect(QuoteHarness(quotes)).toEqual(first);
  effects();

  jest.advanceTimersByTime(60_000);
  await settle();
  expect(QuoteHarness(quotes)).toEqual(first);
  effects();
});

it('keeps the same live quote when the Home route blurs, stops polling, then clears on app background', async () => {
  const quotes = source();
  const first = makeQuote();
  quotes.load.mockResolvedValueOnce(first).mockImplementation(() => new Promise(() => undefined));
  expect(QuoteHarness(quotes)).toBeUndefined();
  effects();
  await settle();
  expect(QuoteHarness(quotes)).toEqual(first);
  effects(); // schedule the five-minute expiry callback

  expect(QuoteHarness(quotes, 'USD', false)).toEqual(first);
  effects(); // cancel polling, retain visible estimate
  jest.advanceTimersByTime(60_000);
  expect(quotes.load).toHaveBeenCalledTimes(1);
  expect(QuoteHarness(quotes, 'USD', false)).toEqual(first);

  emitAppState('background');
  expect(QuoteHarness(quotes, 'USD', false)).toBeUndefined();
  effects();
});

it('does not expose a previous quote across provider or currency replacement', async () => {
  const oldSource = source();
  const newSource = source();
  oldSource.load.mockResolvedValueOnce(makeQuote()).mockImplementation(() => new Promise(() => undefined));
  newSource.load.mockImplementation(() => new Promise(() => undefined));
  QuoteHarness(oldSource);
  effects();
  await settle();
  expect(QuoteHarness(oldSource)).toBeDefined();
  effects();

  expect(QuoteHarness(newSource)).toBeUndefined(); // render-level isolation, even before effects
  effects();
  expect(QuoteHarness(newSource)).toBeUndefined();
  expect(QuoteHarness(oldSource, 'EUR')).toBeUndefined();
  effects();
});

it('expires at five minutes even without a new Home render or a successful 60-second poll', async () => {
  const quotes = source();
  const first = makeQuote();
  quotes.load.mockResolvedValueOnce(first).mockImplementation(() => new Promise(() => undefined));
  QuoteHarness(quotes);
  effects();
  await settle();
  expect(QuoteHarness(quotes)).toEqual(first);
  effects(); // set an expiry timeout independent of balance or navigation updates

  jest.advanceTimersByTime(299_000);
  expect(QuoteHarness(quotes)).toEqual(first);
  effects();
  jest.advanceTimersByTime(1_000);
  expect(QuoteHarness(quotes)).toBeUndefined();
  effects();
  jest.advanceTimersByTime(1);
  expect(QuoteHarness(quotes)).toBeUndefined();
});

it('refreshes on returning to Home without exposing an expired or old-provider value', async () => {
  const quotes = source();
  const first = makeQuote();
  quotes.load.mockResolvedValueOnce(first).mockResolvedValueOnce({ ...first, rate: '0.70000000' });
  QuoteHarness(quotes);
  effects();
  await settle();
  expect(QuoteHarness(quotes)).toEqual(first);
  effects();

  QuoteHarness(quotes, 'USD', false);
  effects();
  jest.advanceTimersByTime(30_000);
  QuoteHarness(quotes, 'USD', true);
  effects();
  await settle();
  expect(QuoteHarness(quotes)).toMatchObject({ rate: '0.70000000' });
  effects();
});

const creditA: CreditAsset = { kind: 'credit', code: 'USD', issuer: 'GISSUER_A' };
const creditB: CreditAsset = { ...creditA, issuer: 'GISSUER_B' };
function creditFixture(asset = creditA, currency: FiatCurrency = 'USD'): CreditFiatQuote {
  return {
    networkId: 'stellar-mainnet',
    assetKey: asset.code + ':' + asset.issuer,
    currency,
    xlmPerUnit: '2.0000000',
    xlmFiatRate: '0.50000000',
    quotedAt: Date.now(),
    expiresAt: Date.now() + 30_000,
  };
}
function CreditHarness(port: CreditFiatQuotePort, asset = creditA, currency: FiatCurrency = 'USD', active = true) {
  mockCursor = 0;
  return useCreditFiatQuote(port, asset, currency, active);
}

it('never displays a credit quote for another issuer or currency, even before effects run', async () => {
  const load = jest.fn().mockResolvedValueOnce(creditFixture());
  load.mockImplementation(() => new Promise(() => undefined));
  const port = { load };
  CreditHarness(port);
  effects();
  await settle();
  expect(CreditHarness(port)).toEqual(creditFixture());
  expect(CreditHarness(port, creditB)).toBeUndefined();
  expect(CreditHarness(port, creditA, 'EUR')).toBeUndefined();
});

it('drops late credit price results after blur, background, and issuer replacement', async () => {
  let resolveOld!: (quote: CreditFiatQuote) => void;
  let resolveNext!: (quote: CreditFiatQuote) => void;
  const load = jest
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<CreditFiatQuote>(resolve => {
          resolveOld = resolve;
        }),
    )
    .mockImplementationOnce(
      () =>
        new Promise<CreditFiatQuote>(resolve => {
          resolveNext = resolve;
        }),
    )
    .mockResolvedValue(creditFixture(creditB));
  const port = { load };
  CreditHarness(port);
  effects();
  const oldSignal = load.mock.calls[0][2] as AbortSignal;
  CreditHarness(port, creditB);
  effects();
  expect(oldSignal.aborted).toBe(true);
  resolveOld(creditFixture());
  await settle();
  expect(CreditHarness(port, creditB)).toBeUndefined();
  emitAppState('background');
  const nextSignal = load.mock.calls[1][2] as AbortSignal;
  expect(nextSignal.aborted).toBe(true);
  resolveNext(creditFixture(creditB));
  await settle();
  expect(CreditHarness(port, creditB)).toBeUndefined();
  emitAppState('active');
  await settle();
  expect(CreditHarness(port, creditB)).toEqual(creditFixture(creditB));
  expect(CreditHarness(port, creditB, 'USD', false)).toBeUndefined();
  effects();
});

it('expires credit reference prices and retries without retaining an unavailable quote', async () => {
  const load = jest
    .fn()
    .mockResolvedValueOnce(creditFixture())
    .mockRejectedValueOnce(new Error('no-route'))
    .mockImplementation(async () => creditFixture());
  const port = { load };
  CreditHarness(port);
  effects();
  await settle();
  expect(CreditHarness(port)).toBeDefined();
  jest.advanceTimersByTime(30_000);
  await settle();
  expect(CreditHarness(port)).toBeUndefined();
  expect(load).toHaveBeenCalledTimes(2);
  jest.advanceTimersByTime(60_000);
  await settle();
  expect(CreditHarness(port)).toEqual(creditFixture());
  expect(load).toHaveBeenCalledTimes(3);
});
