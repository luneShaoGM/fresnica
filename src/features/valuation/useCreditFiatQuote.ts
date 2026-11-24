import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import {
  creditQuoteCurrent,
  type CreditAsset,
  type CreditFiatQuote,
  type CreditFiatQuotePort,
} from '@capabilities/valuation/creditFiatQuote';
import type { FiatCurrency } from '@capabilities/valuation/xlmQuote';

type Cached = Readonly<{ source: CreditFiatQuotePort; quote: CreditFiatQuote }>;

export function useCreditFiatQuote(
  quotes: CreditFiatQuotePort | undefined,
  asset: CreditAsset,
  currency: FiatCurrency,
  active: boolean,
): CreditFiatQuote | undefined {
  const [cached, setCached] = useState<Cached>();
  const { code, issuer } = asset;
  useEffect(() => {
    setCached(undefined);
    if (!active || !quotes) return;
    const target = { kind: 'credit' as const, code, issuer };
    let live = true;
    let current: AbortController | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let expiry: ReturnType<typeof setTimeout> | undefined;
    const retire = () => {
      current?.abort();
      current = undefined;
      if (retry !== undefined) clearTimeout(retry);
      if (expiry !== undefined) clearTimeout(expiry);
    };
    const load = () => {
      retire();
      setCached(undefined);
      if (!live || AppState.currentState !== 'active') return;
      const owner = new AbortController();
      current = owner;
      const isCurrent = () => live && current === owner && !owner.signal.aborted && AppState.currentState === 'active';
      return (async () => {
        try {
          const quote = await quotes.load(target, currency, owner.signal);
          if (!isCurrent()) return;
          if (!creditQuoteCurrent(quote, target, currency, Date.now())) throw new Error('credit-quote-unavailable');
          const remaining = quote.expiresAt - Date.now();
          setCached({ source: quotes, quote });
          expiry = setTimeout(() => {
            if (isCurrent()) setCached(undefined);
          }, remaining);
          retry = setTimeout(load, remaining);
        } catch {
          if (!isCurrent()) return;
          setCached(undefined);
          retry = setTimeout(load, 60_000);
        }
      })();
    };
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') load();
      else {
        retire();
        setCached(undefined);
      }
    });
    load();
    return () => {
      live = false;
      retire();
      subscription.remove();
    };
  }, [active, quotes, code, issuer, currency]);
  return active &&
    AppState.currentState === 'active' &&
    cached &&
    cached.source === quotes &&
    creditQuoteCurrent(cached.quote, asset, currency, Date.now())
    ? cached.quote
    : undefined;
}
