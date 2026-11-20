import React from 'react';
import { Text } from 'react-native';
import { estimateFiat, type FiatCurrency, type XlmQuotePort } from '@capabilities/valuation/xlmQuote';
import { useThemedStyles } from '@ui/theme';
import { useLocalization } from '../../locale';
import { createStyles } from './styles';
import { useXlmQuote } from './useXlmQuote';
export function NativeFiatEstimate({
  quotes,
  amount,
  currency,
  active,
  compact = false,
}: Readonly<{ quotes?: XlmQuotePort; amount: string; currency: FiatCurrency; active: boolean; compact?: boolean }>) {
  const { t, formatNumber, formatDate } = useLocalization();
  const styles = useThemedStyles(createStyles);
  const quote = useXlmQuote(quotes, currency, active, true);
  const estimate =
    quote?.currency === currency && Date.now() - quote.updatedAt <= 300_000
      ? estimateFiat(amount, quote.rate)
      : undefined;
  if (compact && estimate === undefined) return null;
  return (
    <Text style={compact ? styles.compactHint : styles.hint}>
      {estimate !== undefined && quote
        ? compact
          ? `≈ ${formatNumber(estimate, 2)} ${currency}`
          : `${t('preferences.estimate')}: ≈ ${formatNumber(estimate, 2)} ${currency} · CoinGecko · ${formatDate(quote.updatedAt)}`
        : compact
          ? null
          : t('preferences.quoteUnavailable')}
    </Text>
  );
}
