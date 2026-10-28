import React, { useSyncExternalStore } from 'react';
import { ScrollView, Text, View } from 'react-native';

import type { NetworkSettings } from '@capabilities/network/createNetworkSettings';
import { NetworkManagement } from './NetworkManagement';
import type { NodeHealthMonitor } from '@capabilities/network/NodeHealthMonitor';
import { Screen } from '@ui/components';
import { NativeButton } from '@ui/components/NativeButton';

import { useThemedStyles } from '../../ui/theme';

import { NetworkNodeHealth } from './NetworkNodeHealth';
import { createStyles } from './NetworkSettingsScreen.styles';

type Props = Readonly<{
  onBack: () => void;
  showBack?: boolean;
  monitor: NodeHealthMonitor;
  settings?: NetworkSettings;
  network: Readonly<{ id: string; horizonUrl: string; isMainnet: boolean }>;
}>;

export function NetworkSettingsScreen({ onBack, network, monitor, settings, showBack = true }: Props) {
  const styles = useThemedStyles(createStyles);

  return (
    <Screen scrollable={false} contentInset="none">
      <View style={styles.header}>
        <View style={styles.headerSide}>
          {showBack ? <NativeButton label="Back" onPress={onBack} size="sm" variant="quiet" /> : null}
        </View>
        <Text style={styles.title}>Network</Text>
        <View style={styles.headerSide} />
      </View>

      {settings ? (
        <ManagedNetworkSettings monitor={monitor} network={network} settings={settings} />
      ) : (
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
          <NetworkNodeHealth monitor={monitor} />
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>Network switching is read-only for now</Text>
            <Text style={styles.noticeText}>
              The release policy is Mainnet by default. Testnet and custom Horizon/RPC endpoints become available only
              through authenticated Developer Mode. This development build is still configured for Testnet until that
              switching flow reaches its product gate.
            </Text>
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}

function ManagedNetworkSettings({
  monitor,
  network,
  settings,
}: Readonly<{
  monitor: NodeHealthMonitor;
  network: Props['network'];
  settings: NetworkSettings;
}>) {
  const styles = useThemedStyles(createStyles);
  const choosing = !useSyncExternalStore(settings.subscribe, settings.getSnapshot).preferences.selectionConfirmed;
  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {choosing ? <NetworkManagement settings={settings} /> : null}
      {choosing ? null : <CurrentNetwork network={network} />}
      <ConnectionDetails network={network} />
      <NetworkNodeHealth monitor={monitor} />
      {choosing ? null : <NetworkManagement settings={settings} />}
    </ScrollView>
  );
}

function CurrentNetwork({ network }: Readonly<{ network: Props['network'] }>) {
  const styles = useThemedStyles(createStyles);
  return (
    <>
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
    </>
  );
}

function ConnectionDetails({ network }: Readonly<{ network: Props['network'] }>) {
  const styles = useThemedStyles(createStyles);
  return (
    <>
      <Text style={styles.sectionLabel}>CONNECTION</Text>
      <View style={styles.rows}>
        <InfoRow label="Network ID" value={network.id} />
        <InfoRow label="Horizon" value={network.horizonUrl} multiline />
      </View>
    </>
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
