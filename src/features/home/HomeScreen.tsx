import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export function HomeScreen() {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Fresnica</Text>
      <Text style={styles.subtitle}>Stellar 钱包</Text>
      <View style={styles.card}><Text>账户</Text><Text style={styles.muted}>尚未连接本地账户</Text></View>
      <View style={styles.card}><Text>资产</Text><Text style={styles.muted}>XLM · Assets · Trustlines</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 24, gap: 16 },
  title: { fontSize: 32, fontWeight: '700', color: '#111827', marginTop: 24 },
  subtitle: { fontSize: 16, color: '#6B7280' },
  card: { padding: 20, borderRadius: 16, backgroundColor: '#F3F4F6', gap: 8 },
  muted: { color: '#6B7280' },
});
