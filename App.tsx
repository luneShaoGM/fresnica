import React from 'react';
import { SafeAreaView, StatusBar, StyleSheet } from 'react-native';
import { AppShell } from './src/app/AppShell';

export default function App() {
  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" />
      <AppShell />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
});
