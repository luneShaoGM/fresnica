import React from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';

import {Screen} from '@ui/components';

import type {AccountRecord} from '../../capabilities/account/types';
import {useThemedStyles, type AppTheme} from '@ui/theme';

type Props = Readonly<{
  accounts: readonly AccountRecord[];
  onOpenAccount: (accountId: string) => void;
  onAddAccount: () => void;
  onBack: () => void;
}>;

export function AccountsScreen({accounts, onOpenAccount, onAddAccount, onBack}: Props) {
  const styles = useThemedStyles(createStyles);
  return (
    <Screen scrollable={false} contentInset="none">
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back" accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
        <Text style={styles.title}>Accounts</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.description}>Accounts available on this device</Text>
        {accounts.map(account => (
          <Pressable
            accessibilityRole="button"
            key={account.id}
            onPress={() => onOpenAccount(account.id)}
            style={({pressed}) => [
              styles.accountCard,
              account.hidden ? styles.accountCardHidden : undefined,
              pressed ? styles.pressed : undefined,
            ]}>
            <View style={styles.accountTopRow}>
              <View style={styles.accountIdentity}>
                <Text numberOfLines={1} style={styles.accountLabel}>
                  {account.label || 'Stellar account'}
                </Text>
                <View style={styles.badges}>
                  <View style={styles.accessBadge}>
                    <Text style={styles.accessBadgeText}>{account.identityKind}</Text>
                  </View>
                  {account.hidden ? (
                    <View style={styles.hiddenBadge}>
                      <Text style={styles.hiddenBadgeText}>Hidden</Text>
                    </View>
                  ) : null}
                </View>
              </View>
              <Text style={styles.chevron}>›</Text>
            </View>
            <Text numberOfLines={1} selectable style={styles.address}>
              {account.address}
            </Text>
            <Text style={styles.network}>{account.networkId}</Text>
          </Pressable>
        ))}

        <Pressable
          accessibilityRole="button"
          onPress={onAddAccount}
          style={({pressed}) => [styles.addButton, pressed ? styles.pressed : undefined]}>
          <Text style={styles.addIcon}>＋</Text>
          <Text style={styles.addText}>Add account</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
  header: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  backButton: {width: 42, height: 42, alignItems: 'center', justifyContent: 'center'},
  backGlyph: {fontSize: 36, lineHeight: 38, fontWeight: '300', color: theme.colors.surfaceStrong},
  title: {fontSize: 18, lineHeight: 22, fontWeight: '800', color: theme.colors.textPrimary},
  headerSpacer: {width: 42},
  content: {paddingTop: 16, paddingBottom: 34},
  description: {paddingHorizontal: 20, paddingBottom: 12, fontSize: 12, lineHeight: 16, color: theme.colors.textTertiary},
  accountCard: {
    minHeight: 108,
    marginHorizontal: 20,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderRadius: 14,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  accountCardHidden: {opacity: 0.58},
  accountTopRow: {flexDirection: 'row', alignItems: 'flex-start', gap: 10},
  accountIdentity: {flex: 1, gap: 7},
  accountLabel: {fontSize: 16, lineHeight: 20, color: theme.colors.textPrimary, fontWeight: '800'},
  badges: {flexDirection: 'row', flexWrap: 'wrap', gap: 6},
  accessBadge: {paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: theme.colors.actionPrimaryMuted},
  accessBadgeText: {fontSize: 9, lineHeight: 12, fontWeight: '800', color: theme.colors.actionPrimaryPressed},
  hiddenBadge: {paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: theme.colors.surfaceMuted},
  hiddenBadgeText: {fontSize: 9, lineHeight: 12, fontWeight: '800', color: theme.colors.textSecondary},
  chevron: {fontSize: 28, lineHeight: 30, color: theme.colors.textTertiary, fontWeight: '300'},
  address: {fontSize: 11, lineHeight: 15, color: theme.colors.textSecondary, fontVariant: ['tabular-nums']},
  network: {fontSize: 10, lineHeight: 13, color: theme.colors.textTertiary},
  addButton: {
    minHeight: 64,
    marginHorizontal: 20,
    marginTop: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.actionPrimary,
  },
  addIcon: {fontSize: 20, lineHeight: 22, color: theme.colors.onActionPrimary, fontWeight: '600'},
  addText: {fontSize: 15, lineHeight: 19, color: theme.colors.onActionPrimary, fontWeight: '800'},
  pressed: {opacity: 0.68},
  });
}
