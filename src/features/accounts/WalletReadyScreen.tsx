import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {Screen} from '@ui/components';

import type {AccountRecord} from '../../capabilities/account/types';
import {useThemedStyles, type AppTheme} from '@ui/theme';

type Props = Readonly<{
  accounts: readonly AccountRecord[];
  onAddAccount: () => void;
  onOpenSecurity: () => void;
}>;

export function WalletReadyScreen({accounts, onAddAccount, onOpenSecurity}: Props) {
  const styles = useThemedStyles(createStyles);
  return (
    <Screen scrollable={false} contentInset="none">
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
    </Screen>
  );
}

function shortAddress(address: string): string {
  if (address.length <= 24) {
    return address;
  }
  return `${address.slice(0, 10)}…${address.slice(-8)}`;
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
  header: {height: 60, justifyContent: 'center', paddingHorizontal: 20},
  brand: {color: theme.colors.textPrimary, fontSize: 24, lineHeight: 30, fontWeight: '800', letterSpacing: -0.6},
  scroll: {flexGrow: 1, paddingBottom: 24},
  hero: {alignItems: 'center', paddingHorizontal: 26, paddingTop: 30, paddingBottom: 34},
  completeMark: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.actionPrimary,
    marginBottom: 20,
    shadowColor: theme.colors.actionPrimary,
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 4,
  },
  completeGlyph: {color: theme.colors.onActionPrimary, fontSize: 34, lineHeight: 39, fontWeight: '800'},
  title: {color: theme.colors.textPrimary, fontSize: 27, lineHeight: 33, fontWeight: '800', textAlign: 'center', letterSpacing: -0.5},
  body: {color: theme.colors.textSecondary, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 8},
  sectionHeader: {height: 36, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  sectionTitle: {color: theme.colors.textPrimary, fontSize: 14, lineHeight: 18, fontWeight: '800'},
  sectionCount: {minWidth: 22, height: 22, borderRadius: 11, textAlign: 'center', color: theme.colors.textSecondary, backgroundColor: theme.colors.surfaceMuted, fontSize: 11, lineHeight: 22, fontWeight: '700'},
  accountList: {marginHorizontal: 20, borderRadius: 12, backgroundColor: theme.colors.surfaceMuted, overflow: 'hidden'},
  accountRow: {minHeight: 72, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 10},
  accountRowBorder: {borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border},
  accountAvatar: {width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surfaceStrong},
  accountAvatarText: {color: theme.colors.onSurfaceStrong, fontSize: 15, lineHeight: 19, fontWeight: '800'},
  accountIdentity: {flex: 1, gap: 3},
  accountLabel: {color: theme.colors.textPrimary, fontSize: 14, lineHeight: 18, fontWeight: '800'},
  address: {color: theme.colors.textSecondary, fontFamily: 'monospace', fontSize: 10, lineHeight: 14},
  accountMeta: {maxWidth: 105, alignItems: 'flex-end', gap: 3},
  identityKind: {color: theme.colors.actionPrimaryPressed, fontSize: 10, lineHeight: 13, fontWeight: '800', textTransform: 'uppercase'},
  network: {color: theme.colors.textTertiary, fontSize: 9, lineHeight: 12},
  footer: {paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border, gap: 9},
  primaryButton: {height: 50, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.actionPrimary},
  primaryPressed: {backgroundColor: theme.colors.actionPrimaryPressed},
  primaryText: {color: theme.colors.onActionPrimary, fontSize: 15, lineHeight: 20, fontWeight: '800'},
  secondaryButton: {height: 46, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surfaceMuted},
  secondaryText: {color: theme.colors.surfaceStrong, fontSize: 14, lineHeight: 19, fontWeight: '800'},
  pressed: {opacity: 0.68},
  });
}
