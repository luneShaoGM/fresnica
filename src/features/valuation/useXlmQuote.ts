import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import type { FiatCurrency, XlmQuote, XlmQuotePort } from '@capabilities/valuation/xlmQuote';

export function useXlmQuote(
  quotes: XlmQuotePort | undefined,
  currency: FiatCurrency,
  active: boolean,
): XlmQuote | undefined {
  const [quote, setQuote] = useState<XlmQuote>();
  useEffect(() => {
    setQuote(undefined);
    if (!active || !quotes) return;
    let live = true;
    let current: AbortController | undefined;
    const load = () => {
      current?.abort();
      current = new AbortController();
      const owner = current;
      if (AppState.currentState !== 'active') {
        setQuote(undefined);
        return;
      }
      quotes
        .load(currency, owner.signal)
        .then(value => {
          if (live && !owner.signal.aborted) setQuote(value);
        })
        .catch(() => {
          if (live && !owner.signal.aborted) setQuote(undefined);
        });
    };
    load();
    const timer = setInterval(load, 60_000);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') load();
      else {
        current?.abort();
        setQuote(undefined);
      }
    });
    return () => {
      live = false;
      current?.abort();
      clearInterval(timer);
      subscription.remove();
    };
  }, [quotes, currency, active]);
  return quote?.currency === currency && Date.now() - quote.updatedAt <= 300_000 ? quote : undefined;
}
