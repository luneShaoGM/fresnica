import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import type {AccountRecord} from '../../capabilities/account/types';
import {Button} from '../../ui/Button';
import {Card} from '../../ui/Card';
import {Screen} from '../../ui/Screen';
import {palette, spacing, typography} from '../../ui/theme';

type Props = Readonly<{
  account: AccountRecord;
  accountCount: number;
  onSwitchAccount: () => void;
  onAddAccount: () => void;
  onOpenAccount: () => void;
  onSend: () => void;
  onManageAssets: () => void;
}>;

export function WalletHomeScreen({
  account,
  accountCount,
  onSwitchAccount,
  onAddAccount,
  onOpenAccount,
  onSend,
  onManageAssets,
}: Props) {
  return (
    <Screen eyebrow="Stellar Testnet" title="Wallet">
      <Card title={account.label || 'Stellar account'}>
        <Text selectable style={styles.address}>
          {account.address}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>{account.identityKind}</Text>
          <Text style={styles.meta}>
            {accountCount === 1 ? '1 account' : `${accountCount} accounts`}
          </Text>
        </View>
        <View style={styles.row}>
          <View style={styles.flex}>
            <Button label="Switch" variant="secondary" onPress={onSwitchAccount} />
          </View>
          <View style={styles.flex}>
            <Button label="Account" variant="secondary" onPress={onOpenAccount} />
          </View>
        </View>
      </Card>

      <Text style={styles.sectionTitle}>Portfolio</Text>
      <Card
        title="Balances"
        description="Portfolio/Horizon read state is not connected to the product shell yet. No balance is inferred from persisted account records."
      />

      <Text style={styles.sectionTitle}>Actions</Text>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Button label="Send" onPress={onSend} />
        </View>
        <View style={styles.flex}>
          <Button label="Manage assets" variant="secondary" onPress={onManageAssets} />
        </View>
      </View>
      <Button label="Add account" variant="ghost" onPress={onAddAccount} />
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  sectionTitle: {
    ...typography.sectionTitle,
    color: palette.text,
    marginTop: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  flex: {
    flex: 1,
  },
});
