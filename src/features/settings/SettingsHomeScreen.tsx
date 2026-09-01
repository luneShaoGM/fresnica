import React from 'react';
import {Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View} from 'react-native';

type Props = Readonly<{
  accountCount: number;
  onOpenAccounts: () => void;
  onOpenSecurity: () => void;
  onOpenNetwork: () => void;
  onOpenAbout: () => void;
}>;

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
            glyph="◎"
            label="Accounts"
            detail={`${accountCount} ${accountCount === 1 ? 'account' : 'accounts'}`}
            onPress={onOpenAccounts}
          />
          <SettingRow glyph="◇" label="Address book" />
        </SettingsGroup>

        <SettingsGroup>
          <SettingRow glyph="☰" label="General" detail="Network" onPress={onOpenNetwork} />
          <SettingRow glyph="⌘" label="Advanced" />
        </SettingsGroup>

        <SettingsGroup>
          <SettingRow glyph="⬡" label="Security" onPress={onOpenSecurity} />
        </SettingsGroup>

        <SettingsGroup>
          <SettingRow glyph="?" label="Questions & Support" />
          <SettingRow glyph="≡" label="Terms & Conditions" />
          <SettingRow glyph="i" label="About" onPress={onOpenAbout} />
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
  glyph,
  label,
  detail,
  onPress,
}: Readonly<{
  glyph: string;
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
        <Text style={styles.iconGlyph}>{glyph}</Text>
      </View>
      <Text style={[styles.label, !enabled ? styles.labelDisabled : undefined]}>{label}</Text>
      <View style={styles.rowTail}>
        {detail ? <Text style={styles.detail}>{detail}</Text> : null}
        {enabled ? <Text style={styles.chevron}>›</Text> : <Text style={styles.soon}>Soon</Text>}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {flex: 1, backgroundColor: '#FFFFFF'},
  content: {paddingHorizontal: 18, paddingTop: 8, paddingBottom: 36},
  title: {fontSize: 28, lineHeight: 34, fontWeight: '800', color: '#000000', letterSpacing: -0.6, marginBottom: 18},
  group: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E7EAF0',
    marginBottom: 18,
  },
  row: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E7EAF0',
    gap: 12,
  },
  iconSlot: {width: 29, height: 29, alignItems: 'center', justifyContent: 'center'},
  iconGlyph: {fontSize: 19, lineHeight: 22, color: '#181D41', fontWeight: '600'},
  label: {flex: 1, fontSize: 15, lineHeight: 19, color: '#000000', fontWeight: '600'},
  labelDisabled: {color: '#606885'},
  rowTail: {flexDirection: 'row', alignItems: 'center', gap: 9},
  detail: {fontSize: 11, lineHeight: 14, color: '#ACB1C1'},
  chevron: {fontSize: 26, lineHeight: 28, color: '#ACB1C1', fontWeight: '300'},
  soon: {fontSize: 10, lineHeight: 13, color: '#ACB1C1'},
  footer: {fontSize: 10, lineHeight: 14, color: '#ACB1C1', textAlign: 'center', marginTop: 4},
  pressed: {opacity: 0.62},
});
