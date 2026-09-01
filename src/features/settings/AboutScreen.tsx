import React from 'react';
import {Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View} from 'react-native';

import {APP_CONFIG} from '../../app/config/appConfig';

type Props = Readonly<{onBack: () => void}>;

export function AboutScreen({onBack}: Props) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back" accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
        <Text style={styles.title}>About</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.logo}><View style={styles.logoDot} /></View>
          <Text style={styles.appName}>{APP_CONFIG.appName}</Text>
          <Text style={styles.tagline}>Stellar wallet powered by the Fresnica Native SDK security boundary.</Text>
        </View>

        <View style={styles.rows}>
          <InfoRow label="Project" value={APP_CONFIG.projectName} />
          <InfoRow label="Network" value="Stellar Testnet" />
          <InfoRow label="Runtime" value="React Native 0.87" />
          <InfoRow label="Security" value="Fresnica Native SDK" />
        </View>

        <View style={styles.note}>
          <Text style={styles.noteTitle}>Compatibility</Text>
          <Text style={styles.noteText}>
            Native SDK and adapter compatibility is enforced at the platform boundary. Detailed diagnostics remain developer/support tooling rather than wallet state.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({label, value}: Readonly<{label: string; value: string}>) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text numberOfLines={2} style={styles.infoValue}>{value}</Text>
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
  content: {paddingBottom: 38},
  hero: {alignItems: 'center', paddingHorizontal: 30, paddingTop: 34, paddingBottom: 30, gap: 10},
  logo: {width: 74, height: 74, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#181D41'},
  logoDot: {width: 26, height: 26, borderRadius: 13, backgroundColor: '#00CA8A'},
  appName: {fontSize: 22, lineHeight: 27, fontWeight: '800', color: '#000000'},
  tagline: {fontSize: 12, lineHeight: 17, color: '#606885', textAlign: 'center'},
  rows: {borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E7EAF0'},
  infoRow: {minHeight: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, gap: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E7EAF0'},
  infoLabel: {fontSize: 13, lineHeight: 17, color: '#000000', fontWeight: '600'},
  infoValue: {flex: 1, fontSize: 12, lineHeight: 16, color: '#606885', textAlign: 'right'},
  note: {marginHorizontal: 18, marginTop: 24, padding: 15, borderRadius: 12, backgroundColor: '#F3F6FA', gap: 6},
  noteTitle: {fontSize: 13, lineHeight: 17, fontWeight: '800', color: '#181D41'},
  noteText: {fontSize: 11, lineHeight: 16, color: '#606885'},
});
