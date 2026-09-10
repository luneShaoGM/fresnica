import React from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';

import {ListRow, Screen} from '@ui/components';

import {useLocalization} from '../../locale';
import {useThemedStyles, type AppTheme} from '../../ui/theme';

type Props = Readonly<{
  accountCount: number;
  onOpenAccounts: () => void;
  onOpenSecurity: () => void;
  onOpenNetwork: () => void;
  onOpenLanguage: () => void;
  onOpenAbout: () => void;
}>;

export function SettingsHomeScreen({
  accountCount,
  onOpenAccounts,
  onOpenSecurity,
  onOpenNetwork,
  onOpenLanguage,
  onOpenAbout,
}: Props) {
  const {locale, locales, t, tPlural} = useLocalization();
  const styles = useThemedStyles(createStyles);
  const currentLocaleName = locales.find(option => option.code === locale)?.localName ?? locale;

  return (
    <Screen scrollable={false} contentInset="none">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{t('settings.title')}</Text>

        <SettingsGroup>
          <ListRow
            onPress={onOpenAccounts}
            subtitle={tPlural('settings.accountCount', accountCount)}
            title={t('settings.accounts')}
          />
          <ListRow subtitle={t('settings.soon')} title={t('settings.addressBook')} />
        </SettingsGroup>

        <SettingsGroup>
          <ListRow
            onPress={onOpenNetwork}
            subtitle={t('settings.generalDetail')}
            title={t('settings.general')}
          />
          <ListRow
            onPress={onOpenLanguage}
            subtitle={currentLocaleName}
            title={t('settings.language')}
          />
          <ListRow subtitle={t('settings.soon')} title={t('settings.advanced')} />
        </SettingsGroup>

        <SettingsGroup>
          <ListRow onPress={onOpenSecurity} title={t('settings.security')} />
        </SettingsGroup>

        <SettingsGroup>
          <ListRow subtitle={t('settings.soon')} title={t('settings.support')} />
          <ListRow subtitle={t('settings.soon')} title={t('settings.terms')} />
          <ListRow onPress={onOpenAbout} title={t('settings.about')} />
        </SettingsGroup>

        <Text style={styles.footer}>{t('settings.footer')}</Text>
      </ScrollView>
    </Screen>
  );
}

function SettingsGroup({children}: Readonly<{children?: React.ReactNode}>) {
  const styles = useThemedStyles(createStyles);
  return <View style={styles.group}>{children}</View>;
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    content: {
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.sm,
      paddingBottom: theme.spacing.xl,
    },
    title: {
      ...theme.typography.title,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.md,
    },
    group: {
      marginBottom: theme.spacing.lg,
    },
    footer: {
      ...theme.typography.caption,
      color: theme.colors.textTertiary,
      textAlign: 'center',
      marginTop: theme.spacing.xs,
    },
  });
}
