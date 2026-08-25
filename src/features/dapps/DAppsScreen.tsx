import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export function DAppsScreen() {
  return <View style={styles.root}><Text style={styles.title}>DApp</Text><Text style={styles.muted}>Discovery · Trusted DApps · Sessions · Signing Requests</Text></View>;
}
const styles = StyleSheet.create({ root: { flex: 1, padding: 24 }, title: { fontSize: 28, fontWeight: '700', marginTop: 24, marginBottom: 8 }, muted: { color: '#6B7280' } });
