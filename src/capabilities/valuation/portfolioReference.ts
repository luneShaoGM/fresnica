import type { BalanceLine } from '../balance/types';
import { walletAssetKey } from '../assets/walletAssetIdentity';
import { stroops } from '../stellar/classicAmounts';
import { creditQuoteCurrent, type CreditFiatQuotePort } from './creditFiatQuote';
import type { FiatCurrency, XlmQuotePort } from './xlmQuote';

const MAX_CREDITS = 8;
const XLM_TTL = 300_000;
const SCALE = 10n ** 20n;

type Missing = Readonly<{ key: string; reason: 'no-price' | 'budget' | 'invalid' }>;
export type PortfolioReference = Readonly<{
  cents?: string;
  currency: FiatCurrency;
  covered: number;
  total: number;
  missing: readonly Missing[];
  expiresAt: number;
}>;

function rate(value: string): bigint {
  if (!/^(0|[1-9]\d{0,6})\.\d{8}$/.test(value)) throw new Error('portfolio-price');
  const result = BigInt(value.replace('.', ''));
  if (result <= 0n || result > 100_000_000_000_000n) throw new Error('portfolio-price');
  return result;
}

export async function loadPortfolioReference(
  lines: readonly BalanceLine[],
  networkId: string,
  currency: FiatCurrency,
  ports: Readonly<{ xlm: XlmQuotePort; credit: CreditFiatQuotePort }>,
  signal: AbortSignal,
  now: () => number = Date.now,
): Promise<PortfolioReference> {
  if (networkId !== 'stellar-mainnet' || signal.aborted || !['USD', 'EUR', 'CNY'].includes(currency))
    throw new Error('portfolio-unavailable');
  const started = now();
  if (!Number.isSafeInteger(started) || started < 0) throw new Error('portfolio-unavailable');
  const assertCurrent = () => {
    if (signal.aborted || now() < started || now() >= started + 30_000) throw new Error('portfolio-retired');
  };

  const unique = new Map<string, BalanceLine>();
  const conflicting = new Set<string>();
  for (const line of lines) {
    const key = walletAssetKey(networkId, line.asset);
    const prior = unique.get(key);
    if (prior) {
      try {
        if (stroops(prior.balance) !== stroops(line.balance)) conflicting.add(key);
      } catch {
        conflicting.add(key);
      }
    } else unique.set(key, line);
  }
  const missing: Missing[] = [];
  const eligible: [string, BalanceLine, bigint][] = [];
  for (const [key, line] of unique) {
    try {
      if (conflicting.has(key)) throw new Error('invalid_request');
      eligible.push([key, line, stroops(line.balance)]);
    } catch {
      missing.push({ key, reason: 'invalid' });
    }
  }
  let numerator = 0n;
  let covered = 0;
  let expiresAt = started + 30_000;
  const native = eligible.find(([, line]) => line.asset.kind === 'native');
  if (native) {
    const [key, , balance] = native;
    try {
      const quote = await ports.xlm.load(currency, signal);
      assertCurrent();
      const time = now();
      if (
        quote.currency !== currency ||
        quote.source !== 'CoinGecko' ||
        !Number.isSafeInteger(quote.updatedAt) ||
        quote.updatedAt < 0 ||
        quote.updatedAt > time + 60_000 ||
        time >= quote.updatedAt + XLM_TTL
      )
        throw new Error('portfolio-price');
      numerator += balance * rate(quote.rate) * 10_000_000n;
      expiresAt = Math.min(expiresAt, quote.updatedAt + XLM_TTL);
      covered++;
    } catch {
      assertCurrent();
      missing.push({ key, reason: 'no-price' });
    }
  }
  const credits = eligible.filter(([, line]) => line.asset.kind === 'credit');
  for (const [key] of credits.slice(MAX_CREDITS)) missing.push({ key, reason: 'budget' });
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(2, credits.length, MAX_CREDITS) }, async () => {
      while (next < Math.min(MAX_CREDITS, credits.length)) {
        assertCurrent();
        const [key, line, balance] = credits[next++]!;
        if (line.asset.kind !== 'credit') continue;
        try {
          const quote = await ports.credit.load(line.asset, currency, signal);
          assertCurrent();
          if (!creditQuoteCurrent(quote, line.asset, currency, now())) throw new Error('portfolio-price');
          const xlmPerUnit = stroops(quote.xlmPerUnit);
          if (xlmPerUnit <= 0n) throw new Error('portfolio-price');
          numerator += balance * xlmPerUnit * rate(quote.xlmFiatRate);
          expiresAt = Math.min(expiresAt, quote.expiresAt);
          covered++;
        } catch {
          assertCurrent();
          missing.push({ key, reason: 'no-price' });
        }
      }
    }),
  );
  assertCurrent();
  if (now() >= expiresAt) throw new Error('portfolio-retired');
  const cents = (numerator + SCALE / 2n) / SCALE;
  return {
    ...(covered ? { cents: String(cents / 100n) + '.' + String(cents % 100n).padStart(2, '0') } : {}),
    currency,
    covered,
    total: unique.size,
    missing,
    expiresAt,
  };
}
