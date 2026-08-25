import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { HomeScreen } from '../features/home/HomeScreen';
import { ActivityScreen } from '../features/activity/ActivityScreen';
import { ActionsScreen } from '../features/actions/ActionsScreen';
import { DAppsScreen } from '../features/dapps/DAppsScreen';
import { SettingsScreen } from '../features/settings/SettingsScreen';

type Tab = 'home' | 'activity' | 'actions' | 'dapps' | 'settings';

const tabs: Array<{ id: Tab; label: string }> = [
  { id: 'home', label: '首页' },
  { id: 'activity', label: '活动' },
  { id: 'actions', label: '操作' },
  { id: 'dapps', label: 'DApp' },
  { id: 'settings', label: '设置' },
];

export function AppShell() {
  const [tab, setTab] = useState<Tab>('home');

  const content = {
    home: <HomeScreen />,
    activity: <ActivityScreen />,
    actions: <ActionsScreen />,
    dapps: <DAppsScreen />,
    settings: <SettingsScreen />,
  }[tab];

  return (
    <View style={styles.root}>
      <View style={styles.content}>{content}</View>
      <View style={styles.tabBar}>
        {tabs.map(item => (
          <Pressable key={item.id} onPress={() => setTab(item.id)} style={styles.tab}>
            <Text style={[styles.label, item.id === tab && styles.active]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
  tabBar: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingBottom: 8 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  label: { color: '#6B7280', fontSize: 13 },
  active: { color: '#111827', fontWeight: '700' },
});
