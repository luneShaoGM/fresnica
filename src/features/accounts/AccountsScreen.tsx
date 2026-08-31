import React from 'react';
import {StyleSheet, Text} from 'react-native';

import type {AccountRecord} from '../../capabilities/account/types';
import {Button} from '../../ui/Button';
import {Card} from '../../ui/Card';
import {Screen} from '../../ui/Screen';
import {palette, spacing, typography} from '../../ui/theme';

type Props = Readonly<{
  accounts: readonly AccountRecord[];
  onOpenAccount: (accountId: string) => void;
  onAddAccount: () => void;
}>;

export function AccountsScreen({accounts, onOpenAccount, onAddAccount}: Props) {
  return (
    <Screen eyebrow="Settings" title="Accounts" description="Public account identities stored by Fresnica on this device.">
      {accounts.map(account => (
        <Card key={account.id} title={account.label || 'Stellar account'}>
          <Text selectable style={styles.address}>
            {account.address}
          </Text>
          <Text style={styles.meta}>
            {account.identityKind} · {account.networkId}
          </Text>
          <Button
            label="Account details"
            variant="secondary"
            onPress={() => onOpenAccount(account.id)}
          />
        </Card>
      ))}
      <Button label="Add account" onPress={onAddAccount} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  address: {
    ...typography.caption,
    color: palette.text,
  },
  meta: {
    ...typography.caption,
    color: palette.textMuted,
    marginBottom: spacing.xs,
  },
});
