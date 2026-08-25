import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export function SettingsScreen() {
  return <View style={styles.root}><Text style={styles.title}>设置</Text><Text style={styles.muted}>Security · DApp Connections · Network · Address Book · Advanced</Text></View>;
}
const styles = StyleSheet.create({ root: { flex: 1, padding: 24 }, title: { fontSize: 28, fontWeight: '700', marginTop: 24, marginBottom: 8 }, muted: { color: '#6B7280' } });
