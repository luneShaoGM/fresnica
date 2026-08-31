import React from 'react';
import {StyleSheet, Text} from 'react-native';

import {APP_CONFIG} from '../../app/config/appConfig';
import {Card} from '../../ui/Card';
import {Screen} from '../../ui/Screen';
import {palette, typography} from '../../ui/theme';

export function NetworkSettingsScreen() {
  return (
    <Screen eyebrow="Settings" title="Network">
      <Card title="Stellar Testnet">
        <Text style={styles.label}>Network ID</Text>
        <Text selectable style={styles.value}>{APP_CONFIG.network.id}</Text>
        <Text style={styles.label}>Horizon</Text>
        <Text selectable style={styles.value}>{APP_CONFIG.network.horizonUrl}</Text>
      </Card>
      <Card
        title="Network switching"
        description="Fresnica v1 is intentionally Testnet-only. This page does not expose a Mainnet switch before Mainnet support has its own reviewed product and security milestone."
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: {
    ...typography.label,
    color: palette.textMuted,
  },
  value: {
    ...typography.caption,
    color: palette.text,
  },
});
