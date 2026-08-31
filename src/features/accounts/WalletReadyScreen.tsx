import React from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';

import type {AccountRecord} from '../../capabilities/account/types';

type Props = Readonly<{
  accounts: readonly AccountRecord[];
}>;

export function WalletReadyScreen({accounts}: Props) {
  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text style={styles.eyebrow}>Stellar Testnet</Text>
      <Text style={styles.title}>Fresnica</Text>
      <Text style={styles.body}>
        Onboarding is complete. Portfolio and account actions are the next
        product milestone.
      </Text>
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
