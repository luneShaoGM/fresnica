import React from 'react';
import {StyleSheet, Text} from 'react-native';

import {Button} from '../../ui/Button';
import {Card} from '../../ui/Card';
import {Screen} from '../../ui/Screen';
import {palette, spacing, typography} from '../../ui/theme';

type Props = Readonly<{
  accountCount: number;
  onOpenAccounts: () => void;
  onOpenSecurity: () => void;
  onOpenNetwork: () => void;
  onOpenAbout: () => void;
}>;

export function SettingsHomeScreen({
  accountCount,
  onOpenAccounts,
  onOpenSecurity,
  onOpenNetwork,
  onOpenAbout,
}: Props) {
  return (
    <Screen eyebrow="Fresnica" title="Settings">
      <Text style={styles.sectionTitle}>Wallet</Text>
      <Card
        title="Accounts"
        description={`${accountCount} ${accountCount === 1 ? 'account' : 'accounts'} in this app.`}>
        <Button label="Manage accounts" variant="secondary" onPress={onOpenAccounts} />
      </Card>

      <Text style={styles.sectionTitle}>Security</Text>
      <Card
        title="Application security"
        description="Manage supported System Auth protection and signer enrollment.">
        <Button label="Security settings" variant="secondary" onPress={onOpenSecurity} />
      </Card>

      <Text style={styles.sectionTitle}>Application</Text>
      <Card title="Network" description="Current network and endpoint configuration.">
        <Button label="Network" variant="secondary" onPress={onOpenNetwork} />
      </Card>
      <Card title="About" description="Application and compatibility information.">
        <Button label="About Fresnica" variant="secondary" onPress={onOpenAbout} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    ...typography.sectionTitle,
    color: palette.text,
    marginTop: spacing.sm,
  },
});
