import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {palette, spacing, typography} from '../../ui/theme';
import type {MainTab} from './productRoutes';

type Props = React.PropsWithChildren<
  Readonly<{
    activeTab: MainTab;
    onSelectTab: (tab: MainTab) => void;
  }>
>;

const TAB_LABELS: Readonly<Record<MainTab, string>> = {
  wallet: 'Wallet',
  activity: 'Activity',
  settings: 'Settings',
};

export function ProductShell({children, activeTab, onSelectTab}: Props) {
  return (
    <View style={styles.root}>
      <View style={styles.content}>{children}</View>
      <View accessibilityRole="tablist" style={styles.tabBar}>
        {(Object.keys(TAB_LABELS) as MainTab[]).map(tab => {
          const selected = tab === activeTab;
          return (
            <Pressable
              key={tab}
              accessibilityRole="tab"
              accessibilityState={{selected}}
              onPress={() => onSelectTab(tab)}
              style={({pressed}) => [
                styles.tab,
                selected ? styles.selectedTab : undefined,
                pressed ? styles.pressed : undefined,
              ]}>
              <Text style={[styles.tabText, selected ? styles.selectedTabText : undefined]}>
                {TAB_LABELS[tab]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.background,
  },
  content: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: palette.border,
    backgroundColor: palette.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  tab: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  selectedTab: {
    backgroundColor: palette.background,
  },
  pressed: {
    opacity: 0.72,
  },
  tabText: {
    ...typography.caption,
    color: palette.textMuted,
    fontWeight: '700',
  },
  selectedTabText: {
    color: palette.text,
  },
});
