import { createCoinGeckoXlmQuotes } from '../CoinGeckoXlmQuotes';
it('uses only the fixed public quote URL, caches for 60 seconds, and retires late output', async () => {
  let now = 1794474531000;
  const readText = jest.fn(async () =>
    JSON.stringify({ stellar: { usd: 0.14, last_updated_at: Math.floor(now / 1000) } }),
  );
  const close = jest.fn();
  const quotes = createCoinGeckoXlmQuotes({ readText, close }, () => now);
  const signal = new AbortController().signal;
  await quotes.load('USD', signal);
  await quotes.load('USD', signal);
  expect(readText).toHaveBeenCalledTimes(1);
  expect(readText.mock.calls[0]).toEqual([
    'https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd&include_last_updated_at=true',
    signal,
  ]);
  now += 60001;
  await quotes.load('USD', signal);
  expect(readText).toHaveBeenCalledTimes(2);
  quotes.close();
  await expect(quotes.load('USD', signal)).rejects.toThrow();
  expect(close).toHaveBeenCalledTimes(1);
});
it('rejects malformed/stale/failed providers and cancellation without cached success', async () => {
  for (const body of ['<html>rate limited</html>', JSON.stringify({ stellar: { usd: -1, last_updated_at: 1 } })]) {
    const quotes = createCoinGeckoXlmQuotes({ readText: async () => body, close: jest.fn() });
    await expect(quotes.load('USD', new AbortController().signal)).rejects.toThrow();
  }
  const owner = new AbortController();
  const quotes = createCoinGeckoXlmQuotes({
    readText: async () => {
      owner.abort();
      return '{}';
    },
    close: jest.fn(),
  });
  await expect(quotes.load('EUR', owner.signal)).rejects.toThrow();
});
