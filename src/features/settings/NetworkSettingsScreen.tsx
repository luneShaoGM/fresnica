import React from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';

import {Screen} from '@ui/components';

import {useThemedStyles, type AppTheme} from '../../ui/theme';

type Props = Readonly<{
  onBack: () => void;
  network: Readonly<{ id: string; horizonUrl: string; isMainnet: boolean }>;
}>;

export function NetworkSettingsScreen({onBack, network}: Props) {
  const styles = useThemedStyles(createStyles);

  return (
    <Screen scrollable={false} contentInset="none">
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back" accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
        <Text style={styles.title}>Network</Text>
        <View style={styles.headerSpacer} />
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

function InfoRow({label, value, multiline = false}: Readonly<{label: string; value: string; multiline?: boolean}>) {
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

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    safeArea: {flex: 1, backgroundColor: theme.colors.background},
    header: {
      minHeight: 58,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    backButton: {width: 42, height: 42, alignItems: 'center', justifyContent: 'center'},
    backGlyph: {fontSize: 36, lineHeight: 38, fontWeight: '300', color: theme.colors.secondary},
    title: {fontSize: 18, lineHeight: 22, fontWeight: '800', color: theme.colors.textPrimary},
    headerSpacer: {width: 42},
    content: {paddingBottom: 34},
    sectionLabel: {
      paddingHorizontal: 18,
      paddingTop: 22,
      paddingBottom: 8,
      fontSize: 10,
      lineHeight: 13,
      color: theme.colors.textTertiary,
      fontWeight: '800',
    },
    networkCard: {marginHorizontal: 18, borderRadius: 12, backgroundColor: theme.colors.surfaceMuted, padding: 14},
    networkIdentity: {flexDirection: 'row', alignItems: 'center', gap: 12},
    networkIcon: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surfaceStrong,
    },
    networkDot: {width: 12, height: 12, borderRadius: 6, backgroundColor: theme.colors.warning},
    flex: {flex: 1},
    networkTitle: {fontSize: 15, lineHeight: 19, color: theme.colors.textPrimary, fontWeight: '800'},
    networkSubtitle: {
      fontSize: 11,
      lineHeight: 14,
      color: theme.colors.actionPrimaryPressed,
      fontWeight: '700',
      marginTop: 2,
    },
    selectedMark: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.actionPrimaryMuted,
    },
    selectedGlyph: {fontSize: 14, color: theme.colors.actionPrimaryPressed, fontWeight: '800'},
    rows: {borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border},
    infoRow: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 18,
      gap: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    infoLabel: {fontSize: 13, lineHeight: 17, color: theme.colors.textPrimary, fontWeight: '600'},
    infoValue: {flex: 1, fontSize: 11, lineHeight: 15, color: theme.colors.textSecondary, textAlign: 'right'},
    notice: {
      marginHorizontal: 18,
      marginTop: 22,
      borderRadius: 12,
      backgroundColor: theme.colors.surfaceMuted,
      padding: 15,
      gap: 5,
    },
    noticeTitle: {fontSize: 13, lineHeight: 17, color: theme.colors.secondary, fontWeight: '800'},
    noticeText: {fontSize: 11, lineHeight: 16, color: theme.colors.textSecondary},
  });
}
