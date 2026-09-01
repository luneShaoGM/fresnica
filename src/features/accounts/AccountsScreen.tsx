import React from 'react';
import {Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View} from 'react-native';

import type {AccountRecord} from '../../capabilities/account/types';

type Props = Readonly<{
  accounts: readonly AccountRecord[];
  onOpenAccount: (accountId: string) => void;
  onAddAccount: () => void;
  onBack: () => void;
}>;

export function AccountsScreen({accounts, onOpenAccount, onAddAccount, onBack}: Props) {
  return (
    <SafeAreaView style={styles.safeArea}>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {flex: 1, backgroundColor: '#FFFFFF'},
  header: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E7EAF0',
  },
  backButton: {width: 42, height: 42, alignItems: 'center', justifyContent: 'center'},
  backGlyph: {fontSize: 36, lineHeight: 38, fontWeight: '300', color: '#181D41'},
  title: {fontSize: 18, lineHeight: 22, fontWeight: '800', color: '#000000'},
  headerSpacer: {width: 42},
  content: {paddingTop: 16, paddingBottom: 34},
  description: {paddingHorizontal: 20, paddingBottom: 12, fontSize: 12, lineHeight: 16, color: '#ACB1C1'},
  accountCard: {
    minHeight: 108,
    marginHorizontal: 20,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#E7EAF0',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  accountCardHidden: {opacity: 0.58},
  accountTopRow: {flexDirection: 'row', alignItems: 'flex-start', gap: 10},
  accountIdentity: {flex: 1, gap: 7},
  accountLabel: {fontSize: 16, lineHeight: 20, color: '#000000', fontWeight: '800'},
  badges: {flexDirection: 'row', flexWrap: 'wrap', gap: 6},
  accessBadge: {paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: 'rgba(0, 202, 138, 0.12)'},
  accessBadgeText: {fontSize: 9, lineHeight: 12, fontWeight: '800', color: '#00B279'},
  hiddenBadge: {paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: '#F3F6FA'},
  hiddenBadgeText: {fontSize: 9, lineHeight: 12, fontWeight: '800', color: '#606885'},
  chevron: {fontSize: 28, lineHeight: 30, color: '#ACB1C1', fontWeight: '300'},
  address: {fontSize: 11, lineHeight: 15, color: '#606885', fontVariant: ['tabular-nums']},
  network: {fontSize: 10, lineHeight: 13, color: '#ACB1C1'},
  addButton: {
    minHeight: 64,
    marginHorizontal: 20,
    marginTop: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#00CA8A',
  },
  addIcon: {fontSize: 20, lineHeight: 22, color: '#FFFFFF', fontWeight: '600'},
  addText: {fontSize: 15, lineHeight: 19, color: '#FFFFFF', fontWeight: '800'},
  pressed: {opacity: 0.68},
});
