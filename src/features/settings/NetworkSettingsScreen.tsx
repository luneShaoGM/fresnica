import React from 'react';
import { ScrollView, Text, View } from 'react-native';

import type { NetworkSettings } from '@capabilities/network/createNetworkSettings';
import { NetworkManagement } from './NetworkManagement';
import type { NodeHealthMonitor } from '@capabilities/network/NodeHealthMonitor';
import { Screen } from '@ui/components';
import { NativeButton } from '@ui/components/NativeButton';

import { useThemedStyles } from '../../ui/theme';

import { NetworkNodeHealth } from './NetworkNodeHealth';
import { createStyles } from './NetworkSettingsScreen.styles';
import { useLocalization } from '../../locale';

type Props = Readonly<{
  onBack: () => void;
  showBack?: boolean;
  monitor: NodeHealthMonitor;
  settings?: NetworkSettings;
  network: Readonly<{ id: string; horizonUrl: string; isMainnet: boolean }>;
}>;

export function NetworkSettingsScreen({ onBack, network, monitor, settings, showBack = true }: Props) {
  const styles = useThemedStyles(createStyles);
  const { t } = useLocalization();

  return (
    <Screen scrollable={false} contentInset="none">
      <View style={styles.header}>
        <View style={styles.headerSide}>
          {showBack ? <NativeButton label={t('common.back')} onPress={onBack} size="sm" variant="quiet" /> : null}
        </View>
        <Text accessibilityRole="header" style={styles.title}>
          {t('settings.network')}
        </Text>
        <View style={styles.headerSide} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.sectionLabel}>{t('settings.currentNetwork')}</Text>
        <View style={styles.networkCard}>
          <View style={styles.networkIdentity}>
            <View style={styles.networkIcon}>
              <View style={styles.networkDot} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.networkTitle}>
                {t(network.isMainnet ? 'networkManage.name.stellar-mainnet' : 'networkManage.name.stellar-testnet')}
              </Text>
              <Text style={styles.networkSubtitle}>{t('settings.activeNetwork')}</Text>
            </View>
            <View style={styles.selectedMark}>
              <Text style={styles.selectedGlyph}>✓</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionLabel}>{t('settings.connection')}</Text>
        <View style={styles.rows}>
          <InfoRow label={t('settings.networkId')} value={network.id} />
          <InfoRow label="Horizon" value={network.horizonUrl} multiline />
        </View>

        <NetworkNodeHealth monitor={monitor} />

        {settings ? (
          <NetworkManagement settings={settings} section={showBack ? 'nodes' : 'all'} />
        ) : (
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>{t('settings.readOnlyNetwork')}</Text>
            <Text style={styles.noticeText}>{t('settings.controlsUnavailable')}</Text>
          </View>
        )}
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
