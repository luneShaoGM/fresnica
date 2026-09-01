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

const ACTION_LABELS: Readonly<Record<ProductAction, string>> = {
  send: 'Send',
  swap: 'Swap',
  request: 'Request',
};

const ACTION_ICONS = {
  send: require('../../ui/assets/stellar/icon_send_v2.png'),
  swap: require('../../ui/assets/stellar/icon_swap.png'),
  request: require('../../ui/assets/stellar/icon_request.png'),
} as const;

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

  const handleSelectAction = (action: ProductAction) => {
    if (!actionAvailability[action]) {
      return;
    }
    setActionsOpen(false);
    onSelectAction(action);
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
              <View style={styles.plusHorizontal} />
              <View style={styles.plusVertical} />
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
            <Text style={styles.actionsTitle}>Actions</Text>
            <View style={styles.actionRow}>
              {(['send', 'swap', 'request'] as const).map(action => {
                const enabled = actionAvailability[action];
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{disabled: !enabled}}
                    disabled={!enabled}
                    key={action}
                    onPress={() => handleSelectAction(action)}
                    style={({pressed}) => [
                      styles.actionItem,
                      action === 'swap' ? styles.actionItemDark : styles.actionItemGreen,
                      !enabled ? styles.actionItemDisabled : undefined,
                      pressed ? styles.pressed : undefined,
                    ]}>
                    <Image
                      resizeMode="contain"
                      source={ACTION_ICONS[action]}
                      style={styles.actionIcon}
                    />
                    <Text style={styles.actionLabel}>{ACTION_LABELS[action]}</Text>
                    {!enabled ? <Text style={styles.actionStatus}>Coming soon</Text> : null}
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
