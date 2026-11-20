import { AppState } from 'react-native';
import { useXlmQuote } from '../useXlmQuote';
import type { FiatCurrency, XlmQuote, XlmQuotePort } from '@capabilities/valuation/xlmQuote';

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

jest.mock('react-native', () => ({
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

function QuoteHarness(quoteSource: XlmQuotePort | undefined, currency: FiatCurrency = 'USD', active = true) {
  mockCursor = 0;
  return useXlmQuote(quoteSource, currency, active);
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
