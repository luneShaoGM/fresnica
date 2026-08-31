import React from 'react';
import {StyleSheet, Text} from 'react-native';

import type {AccountRecord} from '../../capabilities/account/types';
import {Button} from '../../ui/Button';
import {Card} from '../../ui/Card';
import {Screen} from '../../ui/Screen';
import {palette, spacing, typography} from '../../ui/theme';

type Props = Readonly<{
  account: AccountRecord;
  onSend: () => void;
  onManageAssets: () => void;
}>;

export function AccountDetailsScreen({account, onSend, onManageAssets}: Props) {
  return (
    <Screen eyebrow="Account" title={account.label || 'Stellar account'}>
      <Card title="Public identity">
        <Text selectable style={styles.address}>
          {account.address}
        </Text>
        <Text style={styles.meta}>Identity: {account.identityKind}</Text>
        <Text style={styles.meta}>Network: {account.networkId}</Text>
      </Card>

      <Card
        title="Signer access"
        description="Signer/watch-only state is derived from Account-Signer relationships. A product presenter will expose that derived state here; this screen does not infer it from the address."
      />

      <Card
        title="Assets"
        description="Balances and trustlines will be loaded from Stellar network state, not stored as AccountRecord truth.">
        <Button label="Manage assets" variant="secondary" onPress={onManageAssets} />
      </Card>

      <Button label="Send" onPress={onSend} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  address: {
    ...typography.caption,
    color: palette.text,
    marginBottom: spacing.xs,
  },
  meta: {
    ...typography.caption,
    color: palette.textMuted,
  },
});
