import React from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type {AccountRecord} from '../../capabilities/account/types';
import {palette} from '../../ui/theme';

type Props = Readonly<{
  accounts: readonly AccountRecord[];
  onAddAccount: () => void;
  onOpenSecurity: () => void;
}>;

export function WalletReadyScreen({accounts, onAddAccount, onOpenSecurity}: Props) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.brand}>fresnica</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.completeMark}>
            <Text style={styles.completeGlyph}>✓</Text>
          </View>
          <Text style={styles.title}>Your wallet is ready</Text>
          <Text style={styles.body}>
            Fresnica is ready to use with your Stellar account setup.
          </Text>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Accounts</Text>
          <Text style={styles.sectionCount}>{accounts.length}</Text>
        </View>
        <View style={styles.accountList}>
          {accounts.map((account, index) => (
            <View
              key={account.id}
              style={[
                styles.accountRow,
                index < accounts.length - 1 ? styles.accountRowBorder : undefined,
              ]}>
              <View style={styles.accountAvatar}>
                <Text style={styles.accountAvatarText}>
                  {(account.label || 'S').slice(0, 1).toUpperCase()}
                </Text>
              </View>
              <View style={styles.accountIdentity}>
                <Text numberOfLines={1} style={styles.accountLabel}>
                  {account.label || 'Stellar account'}
                </Text>
                <Text numberOfLines={1} style={styles.address}>
                  {shortAddress(account.address)}
                </Text>
              </View>
              <View style={styles.accountMeta}>
                <Text style={styles.identityKind}>{account.identityKind}</Text>
                <Text numberOfLines={1} style={styles.network}>{account.networkId}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          onPress={onAddAccount}
          style={({pressed}) => [styles.primaryButton, pressed ? styles.primaryPressed : undefined]}>
          <Text style={styles.primaryText}>Add account</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onOpenSecurity}
          style={({pressed}) => [styles.secondaryButton, pressed ? styles.pressed : undefined]}>
          <Text style={styles.secondaryText}>Security</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function shortAddress(address: string): string {
  if (address.length <= 24) {
    return address;
  }
  return `${address.slice(0, 10)}…${address.slice(-8)}`;
}

const styles = StyleSheet.create({
  safeArea: {flex: 1, backgroundColor: palette.background},
  header: {height: 60, justifyContent: 'center', paddingHorizontal: 20},
  brand: {color: palette.text, fontSize: 24, lineHeight: 30, fontWeight: '800', letterSpacing: -0.6},
  scroll: {flexGrow: 1, paddingBottom: 24},
  hero: {alignItems: 'center', paddingHorizontal: 26, paddingTop: 30, paddingBottom: 34},
  completeMark: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.accent,
    marginBottom: 20,
    shadowColor: '#00CA8A',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 4,
  },
  completeGlyph: {color: '#FFFFFF', fontSize: 34, lineHeight: 39, fontWeight: '800'},
  title: {color: palette.text, fontSize: 27, lineHeight: 33, fontWeight: '800', textAlign: 'center', letterSpacing: -0.5},
  body: {color: palette.textMuted, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 8},
  sectionHeader: {height: 36, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  sectionTitle: {color: palette.text, fontSize: 14, lineHeight: 18, fontWeight: '800'},
  sectionCount: {minWidth: 22, height: 22, borderRadius: 11, textAlign: 'center', color: palette.textMuted, backgroundColor: palette.surfaceMuted, fontSize: 11, lineHeight: 22, fontWeight: '700'},
  accountList: {marginHorizontal: 20, borderRadius: 12, backgroundColor: palette.surfaceMuted, overflow: 'hidden'},
  accountRow: {minHeight: 72, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 10},
  accountRowBorder: {borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border},
  accountAvatar: {width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#181D41'},
  accountAvatarText: {color: '#FFFFFF', fontSize: 15, lineHeight: 19, fontWeight: '800'},
  accountIdentity: {flex: 1, gap: 3},
  accountLabel: {color: palette.text, fontSize: 14, lineHeight: 18, fontWeight: '800'},
  address: {color: palette.textMuted, fontFamily: 'monospace', fontSize: 10, lineHeight: 14},
  accountMeta: {maxWidth: 105, alignItems: 'flex-end', gap: 3},
  identityKind: {color: palette.accentPressed, fontSize: 10, lineHeight: 13, fontWeight: '800', textTransform: 'uppercase'},
  network: {color: '#ACB1C1', fontSize: 9, lineHeight: 12},
  footer: {paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border, gap: 9},
  primaryButton: {height: 50, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.accent},
  primaryPressed: {backgroundColor: palette.accentPressed},
  primaryText: {color: '#FFFFFF', fontSize: 15, lineHeight: 20, fontWeight: '800'},
  secondaryButton: {height: 46, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.surfaceMuted},
  secondaryText: {color: '#181D41', fontSize: 14, lineHeight: 19, fontWeight: '800'},
  pressed: {opacity: 0.68},
});
