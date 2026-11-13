import type { XlmQuotePort } from '@capabilities/valuation/xlmQuote';
import { NativeFiatEstimate } from '@features/valuation/NativeFiatEstimate';
import React, { useState } from 'react';
import { Switch, Text } from 'react-native';
import type { GeneralPreferences } from '@capabilities/preferences/generalPreferences';
import { ListRow } from '@ui/components';
import { useThemedStyles } from '@ui/theme';
import { useLocalization } from '../../locale';
import { SettingsSubpage } from './SettingsSubpage';
import { createStyles } from './SettingsSubpage.styles';
import { useGeneralPreferences } from './generalPreferences';

export function GeneralSettingsScreen({
  onBack,
  onOpenLanguage,
  onOpenTheme,
  quotes,
  active = true,
}: Readonly<{
  onBack(): void;
  onOpenLanguage(): void;
  onOpenTheme?: () => void;
  quotes?: XlmQuotePort;
  active?: boolean;
}>) {
  const { t, locale, locales } = useLocalization();
  const styles = useThemedStyles(createStyles);
  const { controller, preferences } = useGeneralPreferences();
  const [error, setError] = useState(false);
  const update = (patch: Partial<GeneralPreferences>) => {
    try {
      if (!controller) throw new Error('preferences-unavailable');
      controller.update(patch);
      setError(false);
    } catch {
      setError(true);
    }
  };
  return (
    <SettingsSubpage title={t('settings.general')} onBack={onBack}>
      <ListRow
        title={t('settings.theme')}
        subtitle={t(`preferences.theme.${preferences.theme}`)}
        onPress={onOpenTheme}
        disabled={!controller}
      />
      <ListRow
        title={t('settings.language')}
        subtitle={locales.find(option => option.code === locale)?.localName ?? locale}
        onPress={onOpenLanguage}
      />
      <Text style={styles.label}>{t('settings.currency')}</Text>
      {(['USD', 'EUR', 'CNY'] as const).map(currency => (
        <ListRow
          key={currency}
          title={currency}
          selected={preferences.currency === currency}
          disabled={!controller}
          onPress={() => update({ currency })}
        />
      ))}
      <Text style={styles.helper}>{t('preferences.quoteNote')}</Text>
      <NativeFiatEstimate quotes={quotes} amount="1" currency={preferences.currency} active={active} />
      <ListRow
        title={t('settings.haptic')}
        trailing={
          <Switch
            accessibilityLabel={t('settings.haptic')}
            disabled={!controller}
            value={preferences.haptics}
            onValueChange={haptics => update({ haptics })}
          />
        }
      />
      <ListRow
        title={t('settings.systemSeparators')}
        subtitle={t('preferences.separatorsNote')}
        trailing={
          <Switch
            accessibilityLabel={t('settings.systemSeparators')}
            disabled={!controller}
            value={preferences.systemSeparators}
            onValueChange={systemSeparators => update({ systemSeparators })}
          />
        }
      />
      <Text style={styles.label}>{t('settings.reserveDisplay')}</Text>
      {(['total', 'spendable'] as const).map(reserveDisplay => (
        <ListRow
          key={reserveDisplay}
          title={t(`preferences.balance.${reserveDisplay}`)}
          selected={preferences.reserveDisplay === reserveDisplay}
          disabled={!controller}
          onPress={() => update({ reserveDisplay })}
        />
      ))}
      {error ? (
        <Text accessibilityRole="alert" style={styles.helper}>
          {t('preferences.saveError')}
        </Text>
      ) : null}
    </SettingsSubpage>
  );
}
