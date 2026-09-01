import React from 'react';
import {Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View} from 'react-native';

type Props = Readonly<{
  accountCount: number;
  onOpenAccounts: () => void;
  onOpenSecurity: () => void;
  onOpenNetwork: () => void;
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
  onOpenAbout,
}: Props) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Settings</Text>

        <SettingsGroup>
          <SettingRow
            icon="account"
            label="Accounts"
            detail={`${accountCount} ${accountCount === 1 ? 'account' : 'accounts'}`}
            onPress={onOpenAccounts}
          />
          <SettingRow icon="book" label="Address book" />
        </SettingsGroup>

        <SettingsGroup>
          <SettingRow icon="sliders" label="General" detail="Network" onPress={onOpenNetwork} />
          <SettingRow icon="activity" label="Advanced" />
        </SettingsGroup>

        <SettingsGroup>
          <SettingRow icon="shield" label="Security" onPress={onOpenSecurity} />
        </SettingsGroup>

        <SettingsGroup>
          <SettingRow icon="help" label="Questions & Support" />
          <SettingRow icon="info" label="Terms & Conditions" />
          <SettingRow icon="info" label="About" onPress={onOpenAbout} />
        </SettingsGroup>

        <Text style={styles.footer}>Fresnica · Stellar Testnet</Text>
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
          <Text style={styles.soon}>Soon</Text>
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
