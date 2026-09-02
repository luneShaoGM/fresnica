import React, {useState} from 'react';
import {Image, Modal, Pressable, Text, View} from 'react-native';

import {useThemedStyles} from '../../ui/theme';
import {createStyles} from './ProductShell.styles';
import type {MainTab, ProductAction} from './productRoutes';

type Props = React.PropsWithChildren<
  Readonly<{
    activeTab: MainTab;
    actionAvailability: Readonly<Record<ProductAction, boolean>>;
    onSelectTab: (tab: MainTab) => void;
    onSelectAction: (action: ProductAction) => void;
    showTabBar?: boolean;
  }>
>;

const TAB_LABELS: Readonly<Record<MainTab, string>> = {
  home: 'Home',
  events: 'Activity',
  xapps: 'dApps',
  settings: 'Settings',
};

const TAB_ICONS = {
  home: {
    idle: require('../../ui/assets/stellar/icon_tabbar_home.png'),
    selected: require('../../ui/assets/stellar/icon_tabbar_home_selected.png'),
  },
  events: {
    idle: require('../../ui/assets/stellar/icon_tabbar_events.png'),
    selected: require('../../ui/assets/stellar/icon_tabbar_events_selected.png'),
  },
  xapps: {
    idle: require('../../ui/assets/stellar/icon_tabbar_xapp.png'),
    selected: require('../../ui/assets/stellar/icon_tabbar_xapp_selected.png'),
  },
  settings: {
    idle: require('../../ui/assets/stellar/icon_tabbar_settings.png'),
    selected: require('../../ui/assets/stellar/icon_tabbar_settings_selected.png'),
  },
} as const;

const tabActionsIcon = require('../../ui/assets/stellar/icon_tabbar_actions.png');
const swapIcon = require('../../ui/assets/stellar/icon_swap.png');
const SHORTCUT_SLOTS = [0, 1, 2, 3] as const;

export function ProductShell({
  children,
  activeTab,
  actionAvailability,
  onSelectTab,
  onSelectAction,
  showTabBar = true,
}: Props) {
  const styles = useThemedStyles(createStyles);
  const [isActionsOpen, setActionsOpen] = useState(false);

  const renderTab = (tab: MainTab) => {
    const selected = tab === activeTab;
    const icon = TAB_ICONS[tab];
    return (
      <Pressable
        accessibilityRole="tab"
        accessibilityState={{selected}}
        key={tab}
        onPress={() => onSelectTab(tab)}
        style={({pressed}) => [styles.tab, pressed ? styles.pressed : undefined]}>
        <Image
          resizeMode="contain"
          source={selected ? icon.selected : icon.idle}
          style={styles.tabIcon}
        />
        <Text style={[styles.tabText, selected ? styles.selectedTabText : undefined]}>
          {TAB_LABELS[tab]}
        </Text>
      </Pressable>
    );
  };

  const handleSwapPress = () => {
    if (!actionAvailability.swap) {
      return;
    }
    setActionsOpen(false);
    onSelectAction('swap');
  };

  return (
    <View style={styles.root}>
      <View style={styles.content}>{children}</View>
      {showTabBar ? (
        <View style={styles.tabBar}>
          {renderTab('home')}
          {renderTab('events')}
          <View style={styles.actionsSlot}>
            <Pressable
              accessibilityLabel="Actions"
              accessibilityRole="button"
              accessibilityState={{expanded: isActionsOpen}}
              onPress={() => setActionsOpen(true)}
              style={({pressed}) => [
                styles.actionsButton,
                pressed ? styles.actionsButtonPressed : undefined,
              ]}>
              <Image resizeMode="contain" source={tabActionsIcon} style={styles.actionsImage} />
            </Pressable>
          </View>
          {renderTab('xapps')}
          {renderTab('settings')}
        </View>
      ) : null}

      <Modal
        animationType="fade"
        onRequestClose={() => setActionsOpen(false)}
        transparent
        visible={showTabBar && isActionsOpen}>
        <Pressable style={styles.overlay} onPress={() => setActionsOpen(false)}>
          <Pressable
            onPress={event => event.stopPropagation()}
            style={styles.actionsSheet}>
            <View style={styles.sheetHandle} />

            <Text numberOfLines={1} style={styles.actionsSectionTitle}>
              Recently used
            </Text>
            <View style={styles.shortcutRow}>
              {SHORTCUT_SLOTS.map(slot => (
                <View key={`recent-${slot}`} style={styles.shortcutItem}>
                  <View style={[styles.shortcutIconShell, styles.shortcutPlaceholder]} />
                  <View style={styles.shortcutLabelPlaceholder} />
                </View>
              ))}
            </View>

            <Text numberOfLines={1} style={styles.actionsSectionTitle}>
              Quick actions
            </Text>
            <View style={styles.shortcutRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{disabled: !actionAvailability.swap}}
                disabled={!actionAvailability.swap}
                onPress={handleSwapPress}
                style={({pressed}) => [
                  styles.shortcutItem,
                  !actionAvailability.swap ? styles.shortcutDisabled : undefined,
                  pressed ? styles.pressed : undefined,
                ]}>
                <View style={[styles.shortcutIconShell, styles.nativeShortcutIcon]}>
                  <Image resizeMode="contain" source={swapIcon} style={styles.shortcutIcon} />
                </View>
                <Text numberOfLines={2} style={styles.shortcutLabel}>
                  Swap
                </Text>
              </Pressable>
              {SHORTCUT_SLOTS.slice(1).map(slot => (
                <View key={`quick-${slot}`} style={styles.shortcutItem}>
                  <View style={[styles.shortcutIconShell, styles.shortcutPlaceholder]} />
                  <View style={styles.shortcutLabelPlaceholder} />
                </View>
              ))}
            </View>

            <View
              accessibilityRole="button"
              accessibilityState={{disabled: true}}
              style={[styles.scanButton, styles.scanButtonDisabled]}>
              <Text style={styles.scanGlyph}>▣</Text>
              <Text style={styles.scanLabel}>Scan a QR code</Text>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
