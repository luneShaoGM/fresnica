import React from 'react';
import { Text, View } from 'react-native';

import { ListRow, Screen } from '@ui/components';
import { NativeScreen } from '@ui/components/NativeScreen';

import { useLocalization } from '../../locale';
import { useThemedStyles } from '../../ui/theme';

import { createStyles } from './SettingsHomeScreen.styles';

type Props = Readonly<{
  accountCount: number;
  onOpenAccounts: () => void;
  onOpenSecurity: () => void;
  onOpenGeneral: () => void;
  onOpenAdvanced: () => void;
  onOpenAbout: () => void;
}>;

export function SettingsHomeScreen({
  accountCount,
  onOpenAccounts,
  onOpenSecurity,
  onOpenGeneral,
  onOpenAdvanced,
  onOpenAbout,
}: Props) {
  const { t, tPlural } = useLocalization();
  const styles = useThemedStyles(createStyles);

  return (
    <Screen scrollable={false} contentInset="none">
      <NativeScreen padded={false} scroll>
        <View style={styles.content}>
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
            <ListRow onPress={onOpenGeneral} subtitle={t('settings.generalDetail')} title={t('settings.general')} />
            <ListRow onPress={onOpenAdvanced} subtitle={t('settings.advancedDetail')} title={t('settings.advanced')} />
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
        </View>
      </NativeScreen>
    </Screen>
  );
}

function SettingsGroup({ children }: Readonly<{ children?: React.ReactNode }>) {
  const styles = useThemedStyles(createStyles);
  return <View style={styles.group}>{children}</View>;
}
