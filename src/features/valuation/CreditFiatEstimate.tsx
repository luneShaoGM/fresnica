import React from 'react';
import { Text, View } from 'react-native';
import {
  estimateCreditFiat,
  type CreditAsset,
  type CreditFiatQuotePort,
} from '@capabilities/valuation/creditFiatQuote';
import { useThemedStyles } from '@ui/theme';
import { useLocalization } from '../../locale';
import { createStyles } from './styles';
import { useCreditFiatQuote } from './useCreditFiatQuote';

export function CreditFiatEstimate({
  quotes,
  asset,
  balance,
  active,
}: Readonly<{
  quotes: CreditFiatQuotePort;
  asset: CreditAsset;
  balance: string;
  active: boolean;
}>) {
  const { t, formatNumber, displayPreferences } = useLocalization();
  const styles = useThemedStyles(createStyles);
  const currency = displayPreferences?.currency ?? 'USD';
  const quote = useCreditFiatQuote(quotes, asset, currency, active);
  const estimate = quote ? estimateCreditFiat(balance, quote) : undefined;
  if (estimate === undefined) return <Text style={styles.creditHint}>{t('assets.valuation.unavailable')}</Text>;
  return (
    <View>
      <Text style={styles.creditHint}>
        {t('assets.valuation.reference')}: ≈ {formatNumber(estimate, 2)} {currency}
      </Text>
      <Text style={styles.creditHint}>{t('assets.valuation.explanation')}</Text>
    </View>
  );
}
