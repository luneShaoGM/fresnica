import type { BalanceAsset } from '../balance/types';
import { walletAssetKey } from '../assets/walletAssetIdentity';
import { NETWORKS } from '../network/networkPreferences';
import type { PathPaymentQuoteGatewayPort } from '../path-payment/types';
import { validatePaymentAsset } from '../payment/preparePayment';
import { amount, assetKey, stroops } from '../stellar/classicAmounts';
import type { FiatCurrency, XlmQuotePort } from './xlmQuote';

export type CreditAsset = Extract<BalanceAsset, { kind: 'credit' }>;
export type CreditFiatQuote = Readonly<{
  networkId: 'stellar-mainnet';
  assetKey: string;
  currency: FiatCurrency;
  xlmPerUnit: string;
  xlmFiatRate: string;
  quotedAt: number;
  expiresAt: number;
}>;
export interface CreditFiatQuotePort {
  load(asset: CreditAsset, currency: FiatCurrency, signal: AbortSignal): Promise<CreditFiatQuote>;
}

const MAINNET = NETWORKS['stellar-mainnet'];
const UNIT = 10_000_000n;
const QUOTE_TTL = 30_000;
const XLM_TTL = 300_000;

function fiatRate(value: string): bigint {
  if (!/^(0|[1-9]\d{0,6})\.\d{8}$/.test(value)) throw new Error('credit-quote-unavailable');
  const result = BigInt(value.replace('.', ''));
  if (result <= 0n || result > 100_000_000_000_000n) throw new Error('credit-quote-unavailable');
  return result;
}

// The fixed-size public market lookup is independent of wallet address and
// balance. This reference price is never a transaction quote or spend limit.
export function createCreditFiatQuotes(
  deps: Readonly<{
    gateway: PathPaymentQuoteGatewayPort;
    xlmQuotes: XlmQuotePort;
    isClassicAccountAddress: (address: string) => boolean;
    now: () => number;
  }>,
): CreditFiatQuotePort {
  const assertCurrent = (signal: AbortSignal) => {
    if (
      signal.aborted ||
      deps.gateway.network.id !== MAINNET.id ||
      deps.gateway.network.networkPassphrase !== MAINNET.networkPassphrase
    )
      throw new Error('credit-quote-unavailable');
  };
  return {
    async load(asset, currency, signal) {
      assertCurrent(signal);
      if (asset.kind !== 'credit' || !['USD', 'EUR', 'CNY'].includes(currency))
        throw new Error('credit-quote-unavailable');
      const sourceAsset = { kind: 'credit' as const, code: asset.code, issuer: asset.issuer };
      validatePaymentAsset(sourceAsset, deps.isClassicAccountAddress);
      const key = walletAssetKey(MAINNET.id, sourceAsset);
      const xlm = await deps.xlmQuotes.load(currency, signal);
      assertCurrent(signal);
      const started = deps.now();
      if (
        xlm.currency !== currency ||
        xlm.source !== 'CoinGecko' ||
        !Number.isSafeInteger(started) ||
        started < 0 ||
        !Number.isSafeInteger(xlm.updatedAt) ||
        xlm.updatedAt < 0 ||
        xlm.updatedAt > started + 60_000 ||
        started >= xlm.updatedAt + XLM_TTL
      )
        throw new Error('credit-quote-unavailable');
      fiatRate(xlm.rate);
      const routes = await deps.gateway.loadStrictSendPaths({
        sourceAsset,
        sourceAmount: amount(UNIT),
        destinationAssets: [{ kind: 'native' }],
      });
      assertCurrent(signal);
      if (!Array.isArray(routes) || routes.length === 0 || routes.length > 100)
        throw new Error('credit-quote-unavailable');
      let best = 0n;
      for (const route of routes) {
        if (
          route.sourceAsset.kind !== 'credit' ||
          walletAssetKey(MAINNET.id, route.sourceAsset) !== key ||
          route.destinationAsset.kind !== 'native' ||
          stroops(route.sourceAmount) !== UNIT ||
          !Array.isArray(route.path) ||
          route.path.length > 5
        )
          throw new Error('credit-quote-unavailable');
        for (const intermediate of route.path) {
          validatePaymentAsset(intermediate, deps.isClassicAccountAddress);
          if (intermediate.kind === 'native' || assetKey(intermediate) === assetKey(sourceAsset))
            throw new Error('credit-quote-unavailable');
        }
        const destination = stroops(route.destinationAmount);
        if (destination <= 0n) throw new Error('credit-quote-unavailable');
        if (destination > best) best = destination;
      }
      const expiresAt = Math.min(started + QUOTE_TTL, xlm.updatedAt + XLM_TTL);
      const received = deps.now();
      if (!Number.isSafeInteger(received) || received < started || received >= expiresAt)
        throw new Error('credit-quote-unavailable');
      return Object.freeze({
        networkId: MAINNET.id,
        assetKey: key,
        currency,
        xlmPerUnit: amount(best),
        xlmFiatRate: xlm.rate,
        quotedAt: started,
        expiresAt,
      });
    },
  };
}

export function creditQuoteCurrent(
  quote: CreditFiatQuote,
  asset: CreditAsset,
  currency: FiatCurrency,
  now: number,
): boolean {
  return (
    quote.networkId === MAINNET.id &&
    quote.assetKey === walletAssetKey(MAINNET.id, asset) &&
    quote.currency === currency &&
    Number.isSafeInteger(quote.quotedAt) &&
    Number.isSafeInteger(quote.expiresAt) &&
    quote.expiresAt <= quote.quotedAt + QUOTE_TTL &&
    now >= quote.quotedAt &&
    now < quote.expiresAt
  );
}

export function estimateCreditFiat(balance: string, quote: CreditFiatQuote): string | undefined {
  try {
    // Classic units have seven decimals; XLM/fiat has eight. Multiply before
    // rounding to fiat cents so the reference never loses ledger precision.
    const product = stroops(balance) * stroops(quote.xlmPerUnit) * fiatRate(quote.xlmFiatRate);
    const denominator = 100_000_000_000_000_000_000n;
    const cents = (product + denominator / 2n) / denominator;
    return String(cents / 100n) + '.' + String(cents % 100n).padStart(2, '0');
  } catch {
    return undefined;
  }
}
