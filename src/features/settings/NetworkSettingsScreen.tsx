import React from 'react';
import { ScrollView, Text, View } from 'react-native';

import { Screen } from '@ui/components';
import { NativeButton } from '@ui/components/NativeButton';

import { useThemedStyles } from '../../ui/theme';

import { createStyles } from './NetworkSettingsScreen.styles';

type Props = Readonly<{
  onBack: () => void;
  network: Readonly<{ id: string; horizonUrl: string; isMainnet: boolean }>;
}>;

export function NetworkSettingsScreen({ onBack, network }: Props) {
  const styles = useThemedStyles(createStyles);

  return (
    <Screen scrollable={false} contentInset="none">
      <View style={styles.header}>
        <View style={styles.headerSide}>
          <NativeButton label="Back" onPress={onBack} size="sm" variant="quiet" />
        </View>
        <Text style={styles.title}>Network</Text>
        <View style={styles.headerSide} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>CURRENT NETWORK</Text>
        <View style={styles.networkCard}>
          <View style={styles.networkIdentity}>
            <View style={styles.networkIcon}>
              <View style={styles.networkDot} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.networkTitle}>{network.isMainnet ? 'Stellar Mainnet' : 'Stellar Testnet'}</Text>
              <Text style={styles.networkSubtitle}>{network.isMainnet ? 'Active' : 'Active development network'}</Text>
            </View>
            <View style={styles.selectedMark}>
              <Text style={styles.selectedGlyph}>✓</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionLabel}>CONNECTION</Text>
        <View style={styles.rows}>
          <InfoRow label="Network ID" value={network.id} />
          <InfoRow label="Horizon" value={network.horizonUrl} multiline />
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Network switching is read-only for now</Text>
          <Text style={styles.noticeText}>
            The release policy is Mainnet by default. Testnet and custom Horizon/RPC endpoints become available only
            through authenticated Developer Mode. This development build is still configured for Testnet until that
            switching flow reaches its product gate.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

function InfoRow({ label, value, multiline = false }: Readonly<{ label: string; value: string; multiline?: boolean }>) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text numberOfLines={multiline ? 3 : 1} selectable style={styles.infoValue}>
        {value}
      </Text>
    </View>
  );
}
