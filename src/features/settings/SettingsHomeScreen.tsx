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

        <SettingRow
          icon="account"
          label="Accounts"
          detail={`${accountCount} ${accountCount === 1 ? 'account' : 'accounts'}`}
          onPress={onOpenAccounts}
        />
        <SettingRow icon="book" label="Address book" />

        <View style={styles.divider} />

        <SettingRow icon="sliders" label="General" detail="Network" onPress={onOpenNetwork} />
        <SettingRow icon="activity" label="Advanced" />

        <View style={styles.divider} />

        <SettingRow icon="shield" label="Security" onPress={onOpenSecurity} />

        <View style={styles.divider} />

        <SettingRow icon="help" label="Questions & Support" />
        <SettingRow icon="info" label="Terms & Conditions" />
        <SettingRow icon="info" label="About" onPress={onOpenAbout} />
      </ScrollView>
    </SafeAreaView>
  );
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
  content: {paddingLeft: 18, paddingRight: 12, paddingTop: 8, paddingBottom: 28},
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: -0.6,
    marginBottom: 10,
  },
  row: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  iconSlot: {width: 48, alignItems: 'flex-start', justifyContent: 'center'},
  rowIcon: {width: 25, height: 25, tintColor: '#181D41'},
  label: {flex: 1, fontSize: 15, lineHeight: 20, color: '#000000', fontWeight: '700'},
  labelDisabled: {color: '#606885'},
  rowTail: {flexDirection: 'row', alignItems: 'center', gap: 8},
  detail: {fontSize: 11, lineHeight: 14, color: '#ACB1C1'},
  chevronIcon: {width: 25, height: 25, tintColor: '#181D41'},
  soon: {fontSize: 10, lineHeight: 13, color: '#ACB1C1', paddingRight: 5},
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E7EAF0',
    marginTop: 7,
    marginBottom: 7,
  },
  pressed: {opacity: 0.62},
});
