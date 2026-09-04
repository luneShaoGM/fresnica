import React from 'react';
import {Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View} from 'react-native';

import {useLocalization} from '../../locale';

type Props = Readonly<{
  accountCount: number;
  onOpenAccounts: () => void;
  onOpenSecurity: () => void;
  onOpenNetwork: () => void;
  onOpenLanguage: () => void;
  onOpenAbout: () => void;
}>;

const icons = {
  account: require('../../ui/assets/stellar/icon_account.png'),
  book: require('../../ui/assets/stellar/icon_book.png'),
  sliders: require('../../ui/assets/stellar/icon_sliders.png'),
  activity: require('../../ui/assets/stellar/icon_activity.png'),
  shield: require('../../ui/assets/stellar/icon_shield.png'),
  help: require('../../ui/assets/stellar/icon_help_circle.png'),
  info: require('../../ui/assets/stellar/icon_info.png'),
  chevron: require('../../ui/assets/stellar/icon_chevron_right.png'),
} as const;

type SettingIcon = Exclude<keyof typeof icons, 'chevron'>;

export function SettingsHomeScreen({
  accountCount,
  onOpenAccounts,
  onOpenSecurity,
  onOpenNetwork,
  onOpenLanguage,
  onOpenAbout,
}: Props) {
  const {locale, locales, t, tPlural} = useLocalization();
  const currentLocaleName = locales.find(option => option.code === locale)?.localName ?? locale;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{t('settings.title')}</Text>

        <SettingsGroup>
          <SettingRow
            icon="account"
            label={t('settings.accounts')}
            detail={tPlural('settings.accountCount', accountCount)}
            onPress={onOpenAccounts}
          />
          <SettingRow icon="book" label={t('settings.addressBook')} />
        </SettingsGroup>

        <SettingsGroup>
          <SettingRow
            icon="sliders"
            label={t('settings.general')}
            detail={t('settings.generalDetail')}
            onPress={onOpenNetwork}
          />
          <SettingRow
            icon="book"
            label={t('settings.language')}
            detail={currentLocaleName}
            onPress={onOpenLanguage}
          />
          <SettingRow icon="activity" label={t('settings.advanced')} />
        </SettingsGroup>

        <SettingsGroup>
          <SettingRow icon="shield" label={t('settings.security')} onPress={onOpenSecurity} />
        </SettingsGroup>

        <SettingsGroup>
          <SettingRow icon="help" label={t('settings.support')} />
          <SettingRow icon="info" label={t('settings.terms')} />
          <SettingRow icon="info" label={t('settings.about')} onPress={onOpenAbout} />
        </SettingsGroup>

        <Text style={styles.footer}>{t('settings.footer')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingsGroup({children}: Readonly<{children?: React.ReactNode}>) {
  return <View style={styles.group}>{children}</View>;
}

function SettingRow({
  icon,
  label,
  detail,
  onPress,
}: Readonly<{
  icon: SettingIcon;
  label: string;
  detail?: string;
  onPress?: () => void;
}>) {
  const {t} = useLocalization();
  const enabled = typeof onPress === 'function';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{disabled: !enabled}}
      disabled={!enabled}
      onPress={onPress}
      style={({pressed}) => [styles.row, pressed ? styles.pressed : undefined]}>
      <View style={styles.iconSlot}>
        <Image resizeMode="contain" source={icons[icon]} style={styles.rowIcon} />
      </View>
      <Text style={[styles.label, !enabled ? styles.labelDisabled : undefined]}>{label}</Text>
      <View style={styles.rowTail}>
        {detail ? <Text style={styles.detail}>{detail}</Text> : null}
        {enabled ? (
          <Image resizeMode="contain" source={icons.chevron} style={styles.chevronIcon} />
        ) : (
          <Text style={styles.soon}>{t('settings.soon')}</Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {flex: 1, backgroundColor: '#FFFFFF'},
  content: {paddingHorizontal: 18, paddingTop: 8, paddingBottom: 36},
  title: {fontSize: 28, lineHeight: 34, fontWeight: '800', color: '#000000', letterSpacing: -0.6, marginBottom: 18},
  group: {marginBottom: 18},
  row: {minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12},
  iconSlot: {width: 30, height: 30, alignItems: 'center', justifyContent: 'center'},
  rowIcon: {width: 25, height: 25, tintColor: '#00CA8A'},
  label: {flex: 1, fontSize: 15, lineHeight: 19, color: '#000000', fontWeight: '600'},
  labelDisabled: {color: '#606885'},
  rowTail: {flexDirection: 'row', alignItems: 'center', gap: 9},
  detail: {fontSize: 11, lineHeight: 14, color: '#ACB1C1'},
  chevronIcon: {width: 22, height: 22, tintColor: '#00CA8A'},
  soon: {fontSize: 10, lineHeight: 13, color: '#ACB1C1'},
  footer: {fontSize: 10, lineHeight: 14, color: '#ACB1C1', textAlign: 'center', marginTop: 4},
  pressed: {opacity: 0.62},
});
