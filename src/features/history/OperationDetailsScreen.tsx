import React from 'react';
import {SafeAreaView, ScrollView, StyleSheet, Text, View} from 'react-native';

import {palette} from '../../ui/theme';

type Props = Readonly<{
  operationId: string;
}>;

export function OperationDetailsScreen({operationId}: Props) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Operation details</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.operationMark}>
            <Text style={styles.operationGlyph}>↗</Text>
          </View>
          <Text style={styles.eyebrow}>STELLAR ACTIVITY</Text>
          <Text style={styles.title}>Operation</Text>
        </View>

        <View style={styles.detailsCard}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Operation ID</Text>
            <Text selectable numberOfLines={2} style={styles.detailValue}>
              {operationId}
            </Text>
          </View>
          <View style={styles.separator} />
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Network data</Text>
            <Text style={styles.pendingValue}>Pending</Text>
          </View>
        </View>

        <View style={styles.infoBox}>
          <View style={styles.infoMark}>
            <Text style={styles.infoGlyph}>i</Text>
          </View>
          <Text style={styles.infoText}>
            Operation detail presentation will be populated from Horizon history data. No transaction or signer material is carried in navigation parameters.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {flex: 1, backgroundColor: palette.background},
  header: {
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
    paddingHorizontal: 18,
  },
  headerTitle: {color: palette.text, fontSize: 16, lineHeight: 21, fontWeight: '800'},
  scroll: {flexGrow: 1, paddingHorizontal: 20, paddingBottom: 30},
  hero: {alignItems: 'center', paddingTop: 34, paddingBottom: 28},
  operationMark: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,202,138,0.12)',
    marginBottom: 15,
  },
  operationGlyph: {color: palette.accentPressed, fontSize: 29, lineHeight: 33, fontWeight: '800'},
  eyebrow: {color: palette.textMuted, fontSize: 10, lineHeight: 13, fontWeight: '800', letterSpacing: 0.9},
  title: {color: palette.text, fontSize: 25, lineHeight: 31, fontWeight: '800', marginTop: 5},
  detailsCard: {borderRadius: 12, backgroundColor: palette.surfaceMuted, paddingHorizontal: 15},
  detailRow: {minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 18},
  detailLabel: {color: palette.textMuted, fontSize: 12, lineHeight: 16, fontWeight: '600'},
  detailValue: {flex: 1, color: palette.text, fontFamily: 'monospace', fontSize: 11, lineHeight: 16, fontWeight: '700', textAlign: 'right'},
  pendingValue: {color: '#ACB1C1', fontSize: 12, lineHeight: 16, fontWeight: '700'},
  separator: {height: StyleSheet.hairlineWidth, backgroundColor: palette.border},
  infoBox: {marginTop: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 13, borderRadius: 10, backgroundColor: '#F3F6FA'},
  infoMark: {width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#181D41'},
  infoGlyph: {color: '#FFFFFF', fontSize: 11, lineHeight: 14, fontWeight: '800'},
  infoText: {flex: 1, color: palette.textMuted, fontSize: 11, lineHeight: 17},
});
