import React from 'react';
import {Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View} from 'react-native';

import {APP_CONFIG} from '../../app/config/appConfig';

type Props = Readonly<{onBack: () => void}>;

export function NetworkSettingsScreen({onBack}: Props) {
  return (
    <SafeAreaView style={styles.safeArea}>
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
            <View style={styles.networkIcon}><View style={styles.networkDot} /></View>
            <View style={styles.flex}>
              <Text style={styles.networkTitle}>Stellar Testnet</Text>
              <Text style={styles.networkSubtitle}>Active</Text>
            </View>
            <View style={styles.selectedMark}><Text style={styles.selectedGlyph}>✓</Text></View>
          </View>
        </View>

        <Text style={styles.sectionLabel}>CONNECTION</Text>
        <View style={styles.rows}>
          <InfoRow label="Network ID" value={APP_CONFIG.network.id} />
          <InfoRow label="Horizon" value={APP_CONFIG.network.horizonUrl} multiline />
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Testnet only</Text>
          <Text style={styles.noticeText}>
            Fresnica v1 intentionally keeps Mainnet disabled until the product and release security gates are complete.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({label, value, multiline = false}: Readonly<{label: string; value: string; multiline?: boolean}>) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text numberOfLines={multiline ? 3 : 1} selectable style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {flex: 1, backgroundColor: '#FFFFFF'},
  header: {minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E7EAF0'},
  backButton: {width: 42, height: 42, alignItems: 'center', justifyContent: 'center'},
  backGlyph: {fontSize: 36, lineHeight: 38, fontWeight: '300', color: '#181D41'},
  title: {fontSize: 18, lineHeight: 22, fontWeight: '800', color: '#000000'},
  headerSpacer: {width: 42},
  content: {paddingBottom: 34},
  sectionLabel: {paddingHorizontal: 18, paddingTop: 22, paddingBottom: 8, fontSize: 10, lineHeight: 13, color: '#ACB1C1', fontWeight: '800'},
  networkCard: {marginHorizontal: 18, borderRadius: 12, backgroundColor: '#F3F6FA', padding: 14},
  networkIdentity: {flexDirection: 'row', alignItems: 'center', gap: 12},
  networkIcon: {width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#181D41'},
  networkDot: {width: 12, height: 12, borderRadius: 6, backgroundColor: '#F8BF4C'},
  flex: {flex: 1},
  networkTitle: {fontSize: 15, lineHeight: 19, color: '#000000', fontWeight: '800'},
  networkSubtitle: {fontSize: 11, lineHeight: 14, color: '#00B279', fontWeight: '700', marginTop: 2},
  selectedMark: {width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 202, 138, 0.12)'},
  selectedGlyph: {fontSize: 14, color: '#00B279', fontWeight: '800'},
  rows: {borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E7EAF0'},
  infoRow: {minHeight: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, gap: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E7EAF0'},
  infoLabel: {fontSize: 13, lineHeight: 17, color: '#000000', fontWeight: '600'},
  infoValue: {flex: 1, fontSize: 11, lineHeight: 15, color: '#606885', textAlign: 'right'},
  notice: {marginHorizontal: 18, marginTop: 22, borderRadius: 12, backgroundColor: '#F3F6FA', padding: 15, gap: 5},
  noticeTitle: {fontSize: 13, lineHeight: 17, color: '#181D41', fontWeight: '800'},
  noticeText: {fontSize: 11, lineHeight: 16, color: '#606885'},
});
