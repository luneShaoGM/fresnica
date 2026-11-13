import React, { useEffect, useState } from 'react';
import { AppState, Text } from 'react-native';
import { estimateFiat, type FiatCurrency, type XlmQuote, type XlmQuotePort } from '@capabilities/valuation/xlmQuote';
import { useThemedStyles } from '@ui/theme';
import { useLocalization } from '../../locale';
import { createStyles } from './styles';
export function NativeFiatEstimate({
  quotes,
  amount,
  currency,
  active,
}: Readonly<{ quotes?: XlmQuotePort; amount: string; currency: FiatCurrency; active: boolean }>) {
  const { t, formatNumber, formatDate } = useLocalization();
  const styles = useThemedStyles(createStyles);
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
  const estimate =
    quote?.currency === currency && Date.now() - quote.updatedAt <= 300_000
      ? estimateFiat(amount, quote.rate)
      : undefined;
  return (
    <Text style={styles.hint}>
      {estimate !== undefined && quote
        ? `${t('preferences.estimate')}: ≈ ${formatNumber(estimate, 2)} ${currency} · CoinGecko · ${formatDate(quote.updatedAt)}`
        : t('preferences.quoteUnavailable')}
    </Text>
  );
}
