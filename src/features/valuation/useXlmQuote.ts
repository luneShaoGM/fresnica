import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import type { FiatCurrency, XlmQuote, XlmQuotePort } from '@capabilities/valuation/xlmQuote';

const QUOTE_TTL_MS = 300_000;
type CachedQuote = Readonly<{ source: XlmQuotePort; currency: FiatCurrency; value: XlmQuote }>;

export function useXlmQuote(
  quotes: XlmQuotePort | undefined,
  currency: FiatCurrency,
  active: boolean,
  clearOnError = false,
): XlmQuote | undefined {
  const [cached, setCached] = useState<CachedQuote>();
  const selected = cached && cached.source === quotes && cached.currency === currency ? cached : undefined;

  // A route overlay pauses polling without invalidating a still-fresh quote.
  // Changing the provider/currency must not resurrect the previous quote.
  useEffect(() => {
    setCached(undefined);
  }, [quotes, currency]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') setCached(undefined);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!active || !quotes) return;
    let live = true;
    let current: AbortController | undefined;
    const load = () => {
      current?.abort();
      current = new AbortController();
      const owner = current;
      if (AppState.currentState !== 'active') {
        setCached(undefined);
        return;
      }
      quotes
        .load(currency, owner.signal)
        .then(value => {
          if (live && !owner.signal.aborted) setCached({ source: quotes, currency, value });
        })
        .catch(() => {
          // Settings must report a failed refresh; Home retains a fresh quote
          // during transient network trouble or while its detail sheet is open.
          if (clearOnError && live && !owner.signal.aborted) setCached(undefined);
        });
    };
    load();
    const timer = setInterval(load, 60_000);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') load();
      else current?.abort();
    });
    return () => {
      live = false;
      current?.abort();
      clearInterval(timer);
      subscription.remove();
    };
  }, [quotes, currency, active, clearOnError]);

  useEffect(() => {
    if (!selected) return;
    const remaining = Math.max(0, selected.value.updatedAt + QUOTE_TTL_MS - Date.now());
    const timer = setTimeout(() => {
      setCached(current => (current === selected ? undefined : current));
    }, remaining);
    return () => clearTimeout(timer);
  }, [selected]);

  return selected && AppState.currentState === 'active' && Date.now() < selected.value.updatedAt + QUOTE_TTL_MS
    ? selected.value
    : undefined;
}
