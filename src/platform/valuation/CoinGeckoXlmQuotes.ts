import { parseXlmQuote, type FiatCurrency, type XlmQuote, type XlmQuotePort } from '@capabilities/valuation/xlmQuote';
export function createCoinGeckoXlmQuotes(
  transport: { readText(url: string, signal: AbortSignal): Promise<string>; close(): void },
  now: () => number = Date.now,
): XlmQuotePort & { close(): void } {
  const cache = new Map<FiatCurrency, { quote: XlmQuote; fetchedAt: number }>();
  let closed = false;
  return {
    async load(currency, signal) {
      if (closed || signal.aborted || !['USD', 'EUR', 'CNY'].includes(currency)) throw new Error('quote-unavailable');
      const hit = cache.get(currency);
      if (hit && now() - hit.fetchedAt >= 0 && now() - hit.fetchedAt < 60_000 && now() - hit.quote.updatedAt < 300_000)
        return hit.quote;
      const body = await transport.readText(
        `https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=${currency.toLowerCase()}&include_last_updated_at=true`,
        signal,
      );
      if (closed || signal.aborted || body.length > 16384) throw new Error('quote-unavailable');
      const quote = parseXlmQuote(JSON.parse(body), currency, now());
      cache.set(currency, { quote, fetchedAt: now() });
      return quote;
    },
    close() {
      closed = true;
      cache.clear();
      transport.close();
    },
  };
}
