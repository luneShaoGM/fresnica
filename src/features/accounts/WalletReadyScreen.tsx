import React from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';

import type {AccountRecord} from '../../capabilities/account/types';

type Props = Readonly<{
  accounts: readonly AccountRecord[];
  onAddAccount: () => void;
  onOpenSecurity: () => void;
}>;

export function WalletReadyScreen({accounts, onAddAccount, onOpenSecurity}: Props) {
  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text style={styles.eyebrow}>Stellar Testnet</Text>
      <Text style={styles.title}>Fresnica</Text>
      <Text style={styles.body}>
        Onboarding is complete. Portfolio and account actions are the next
        product milestone.
      </Text>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={onAddAccount}
          style={styles.actionButton}>
          <Text style={styles.actionButtonText}>Add account</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onOpenSecurity}
          style={styles.actionButton}>
          <Text style={styles.actionButtonText}>Security</Text>
        </Pressable>
      </View>
      {accounts.map(account => (
        <View key={account.id} style={styles.accountCard}>
          <Text style={styles.accountLabel}>
            {account.label || 'Stellar account'}
          </Text>
          <Text selectable style={styles.address}>
            {account.address}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 64,
    gap: 16,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  accountCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  accountLabel: {
    fontSize: 17,
    fontWeight: '700',
  },
  address: {
    fontSize: 13,
    lineHeight: 19,
  },
});
