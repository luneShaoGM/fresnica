import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import type {AccountRecord} from '../../capabilities/account/types';
import {Button} from '../../ui/Button';
import {Card} from '../../ui/Card';
import {Screen} from '../../ui/Screen';
import {palette, spacing, typography} from '../../ui/theme';

type Props = Readonly<{
  accounts: readonly AccountRecord[];
  onAddAccount: () => void;
  onOpenSecurity: () => void;
}>;

export function WalletReadyScreen({accounts, onAddAccount, onOpenSecurity}: Props) {
  return (
    <Screen
      eyebrow="Stellar Testnet"
      title="Fresnica"
      description="Your wallet is ready. Portfolio data and transaction actions will build on this account shell.">
      <View style={styles.actions}>
        <View style={styles.action}>
          <Button label="Add account" onPress={onAddAccount} />
        </View>
        <View style={styles.action}>
          <Button label="Security" variant="secondary" onPress={onOpenSecurity} />
        </View>
      </View>

      <Text style={styles.sectionTitle}>Accounts</Text>
      {accounts.map(account => (
        <Card key={account.id} title={account.label || 'Stellar account'}>
          <Text selectable style={styles.address}>
            {account.address}
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.meta}>{account.identityKind}</Text>
            <Text style={styles.meta}>{account.networkId}</Text>
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  action: {
    flex: 1,
  },
  sectionTitle: {
    ...typography.sectionTitle,
    color: palette.text,
    marginTop: spacing.sm,
  },
  address: {
    ...typography.caption,
    color: palette.text,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  meta: {
    ...typography.caption,
    color: palette.textMuted,
  },
});
