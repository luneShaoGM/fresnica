import React from 'react';
import { Text, View } from 'react-native';
import { ListRow } from '@ui/components';
import { useThemedStyles } from '@ui/theme';
import { useLocalization } from '../../locale';
import { SettingsSubpage } from './SettingsSubpage';
import { createStyles } from './SettingsSubpage.styles';

export function GeneralSettingsScreen({
  onBack,
  onOpenLanguage,
}: Readonly<{ onBack: () => void; onOpenLanguage: () => void }>) {
  const { t, locale, locales } = useLocalization();
  const styles = useThemedStyles(createStyles);
  return (
    <SettingsSubpage title={t('settings.general')} onBack={onBack}>
      <View style={styles.section}>
        <Text style={styles.label}>{t('settings.appearance')}</Text>
      </View>
      {['theme', 'systemAppearance'].map(key => (
        <ListRow key={key} title={t('settings.' + key)} subtitle={t('settings.unavailable')} />
      ))}
      <ListRow
        title={t('settings.language')}
        subtitle={locales.find(option => option.code === locale)?.localName ?? locale}
        onPress={onOpenLanguage}
      />
      {['currency', 'haptic', 'systemSeparators', 'reserveDisplay'].map(key => (
        <ListRow key={key} title={t('settings.' + key)} subtitle={t('settings.unavailable')} />
      ))}
    </SettingsSubpage>
  );
}
