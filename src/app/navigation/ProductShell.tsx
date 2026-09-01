import React from 'react';
import {Image, Pressable, StyleSheet, Text, View} from 'react-native';

import {stellarDonorAssets} from '../../ui/stellarDonorAssets';
import {palette, spacing, typography} from '../../ui/theme';
import type {MainTab} from './productRoutes';

type Props = React.PropsWithChildren<
  Readonly<{
    activeTab: MainTab;
    onSelectTab: (tab: MainTab) => void;
  }>
>;

type TabItem = Readonly<{
  tab: MainTab;
  label: string;
  icon: number;
}>;

const LEFT_TABS: readonly TabItem[] = [
  {tab: 'wallet', label: 'Home', icon: stellarDonorAssets.tabHome},
  {tab: 'activity', label: 'Activity', icon: stellarDonorAssets.tabActivity},
];

const RIGHT_TABS: readonly TabItem[] = [
  {tab: 'dapps', label: 'dApps', icon: stellarDonorAssets.tabDapps},
  {tab: 'settings', label: 'Settings', icon: stellarDonorAssets.tabSettings},
];

export function ProductShell({children, activeTab, onSelectTab}: Props) {
  return (
    <View style={styles.root}>
      <View style={styles.content}>{children}</View>
      <View style={styles.tabBar}>
        {LEFT_TABS.map(item => (
          <Tab key={item.tab} item={item} activeTab={activeTab} onSelectTab={onSelectTab} />
        ))}

        <View style={styles.actionSlot}>
          <View
            accessibilityLabel="Actions"
            accessibilityRole="button"
            accessibilityState={{disabled: true}}
            style={styles.actionButton}>
            <Image source={stellarDonorAssets.tabActions} style={styles.actionIcon} />
          </View>
        </View>

        {RIGHT_TABS.map(item => (
          <Tab key={item.tab} item={item} activeTab={activeTab} onSelectTab={onSelectTab} />
        ))}
      </View>
    </View>
  );
}

function Tab({
  item,
  activeTab,
  onSelectTab,
}: Readonly<{
  item: TabItem;
  activeTab: MainTab;
  onSelectTab: (tab: MainTab) => void;
}>) {
  const selected = item.tab === activeTab;
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{selected}}
      onPress={() => onSelectTab(item.tab)}
      style={({pressed}) => [styles.tab, pressed ? styles.pressed : undefined]}>
      <Image
        source={item.icon}
        style={[styles.tabIcon, {tintColor: selected ? palette.text : palette.textMuted}]}
      />
      <Text style={[styles.tabText, selected ? styles.selectedTabText : undefined]}>
        {item.label}
      </Text>
    </Pressable>
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
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
    backgroundColor: palette.background,
    paddingHorizontal: spacing.xs,
    paddingTop: 6,
    paddingBottom: 5,
    shadowColor: palette.black,
    shadowOffset: {width: 0, height: -4},
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 10,
  },
  tab: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 2,
  },
  tabIcon: {
    width: 25,
    height: 25,
    resizeMode: 'contain',
  },
  tabText: {
    ...typography.caption,
    color: palette.textMuted,
    fontWeight: '700',
    fontSize: 11,
  },
  selectedTabText: {
    color: palette.text,
  },
  actionSlot: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
  },
  actionButton: {
    width: 48,
    height: 48,
    marginTop: -3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIcon: {
    width: 48,
    height: 48,
    resizeMode: 'contain',
  },
  pressed: {
    opacity: 0.6,
  },
});
