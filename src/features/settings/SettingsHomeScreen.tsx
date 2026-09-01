import React from 'react';
import {Image, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';

import {stellarDonorAssets} from '../../ui/stellarDonorAssets';
import {palette, spacing, typography} from '../../ui/theme';

type Props = Readonly<{
  accountCount: number;
  onOpenAccounts: () => void;
  onOpenSecurity: () => void;
  onOpenNetwork: () => void;
  onOpenAbout: () => void;
}>;

type SettingsRowProps = Readonly<{
  label: string;
  icon: number;
  onPress?: () => void;
  detail?: string;
  disabled?: boolean;
}>;

export function SettingsHomeScreen({
  accountCount,
  onOpenAccounts,
  onOpenSecurity,
  onOpenNetwork,
  onOpenAbout,
}: Props) {
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SettingsRow
          label="Accounts"
          detail={String(accountCount)}
          icon={stellarDonorAssets.settingsAccount}
          onPress={onOpenAccounts}
        />
        <SettingsRow
          label="Address book"
          icon={stellarDonorAssets.settingsBook}
          disabled
        />

        <Divider />

        <SettingsRow
          label="General"
          icon={stellarDonorAssets.settingsSliders}
          disabled
        />
        <SettingsRow
          label="Advanced"
          detail="Network"
          icon={stellarDonorAssets.tabActivity}
          onPress={onOpenNetwork}
        />

        <Divider />

        <SettingsRow
          label="Security"
          icon={stellarDonorAssets.settingsShield}
          onPress={onOpenSecurity}
        />

        <Divider />

        <SettingsRow
          label="Questions & Support"
          icon={stellarDonorAssets.settingsHelp}
          disabled
        />
        <SettingsRow
          label="Terms & Conditions"
          icon={stellarDonorAssets.settingsInfo}
          disabled
        />
        <SettingsRow
          label="About"
          icon={stellarDonorAssets.settingsInfo}
          onPress={onOpenAbout}
        />

        <Text style={styles.note}>
          Disabled rows preserve the original Stellar UI structure until their Fresnica product capability is connected.
        </Text>
      </ScrollView>
    </View>
  );
}

function SettingsRow({label, icon, onPress, detail, disabled = false}: SettingsRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{disabled}}
      disabled={disabled}
      onPress={onPress}
      style={({pressed}) => [
        styles.row,
        disabled ? styles.rowDisabled : undefined,
        pressed ? styles.rowPressed : undefined,
      ]}>
      <View style={styles.iconSlot}>
        <Image source={icon} style={styles.rowIcon} />
      </View>
      <Text numberOfLines={1} style={styles.rowLabel}>{label}</Text>
      {detail ? <Text style={styles.rowDetail}>{detail}</Text> : null}
      <Image source={stellarDonorAssets.chevronRight} style={styles.chevron} />
    </Pressable>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: palette.background},
  header: {
    minHeight: 68,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {...typography.title, color: palette.text},
  content: {paddingLeft: spacing.lg, paddingRight: spacing.md, paddingBottom: spacing.xl},
  row: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowDisabled: {opacity: 0.38},
  rowPressed: {opacity: 0.58},
  iconSlot: {width: 44, alignItems: 'flex-start', justifyContent: 'center'},
  rowIcon: {width: 25, height: 25, resizeMode: 'contain', tintColor: palette.text},
  rowLabel: {...typography.body, color: palette.text, fontWeight: '700', flex: 1},
  rowDetail: {...typography.caption, color: palette.textMuted, marginRight: spacing.sm},
  chevron: {width: 22, height: 22, resizeMode: 'contain', tintColor: palette.text},
  divider: {
    borderBottomColor: palette.contrast,
    opacity: 0.15,
    borderBottomWidth: 1,
    marginTop: 7,
    marginBottom: 7,
  },
  note: {...typography.caption, color: palette.textMuted, marginTop: spacing.lg, paddingRight: spacing.lg},
});
