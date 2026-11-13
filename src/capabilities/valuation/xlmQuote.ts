export type FiatCurrency = 'USD' | 'EUR' | 'CNY';
export type XlmQuote = Readonly<{ currency: FiatCurrency; rate: string; updatedAt: number; source: 'CoinGecko' }>;
export interface XlmQuotePort {
  load(currency: FiatCurrency, signal: AbortSignal): Promise<XlmQuote>;
}
export function parseXlmQuote(raw: unknown, currency: FiatCurrency, now: number): XlmQuote {
  const stellar = raw && typeof raw === 'object' ? (raw as Record<string, unknown>).stellar : undefined;
  const fields = stellar && typeof stellar === 'object' ? (stellar as Record<string, unknown>) : {};
  const rate = fields[currency.toLowerCase()];
  const updatedAt = fields.last_updated_at;
  if (
    typeof rate !== 'number' ||
    !Number.isFinite(rate) ||
    rate < 0.00000001 ||
    rate > 1_000_000 ||
    typeof updatedAt !== 'number' ||
    !Number.isSafeInteger(updatedAt) ||
    now - updatedAt * 1000 > 300_000 ||
    updatedAt * 1000 > now + 60_000
  )
    throw new Error('quote-unavailable');
  return Object.freeze({ currency, rate: rate.toFixed(8), updatedAt: updatedAt * 1000, source: 'CoinGecko' });
}
// Approximate fiat display only. Exact ledger quantities are never converted back from this value.
export function estimateFiat(amount: string, rate: string): string | undefined {
  const amountMatch = /^(\d{1,30})(?:\.(\d{1,7}))?$/.exec(amount);
  const rateMatch = /^(\d{1,7})\.(\d{8})$/.exec(rate);
  if (!amountMatch || !rateMatch) return undefined;
  const stroops = BigInt(amountMatch[1]! + (amountMatch[2] ?? '').padEnd(7, '0'));
  const price = BigInt(rateMatch[1]! + rateMatch[2]!);
  const cents = (stroops * price + 5_000_000_000_000n) / 10_000_000_000_000n;
  return `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`;
}
