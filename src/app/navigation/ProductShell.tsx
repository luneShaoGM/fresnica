import React, {useState} from 'react';
import {Modal, Pressable, Text, View} from 'react-native';

import {useThemedStyles} from '../../ui/theme';
import {createStyles} from './ProductShell.styles';
import type {MainTab, ProductAction} from './productRoutes';

type Props = React.PropsWithChildren<
  Readonly<{
    activeTab: MainTab;
    actionAvailability: Readonly<Record<ProductAction, boolean>>;
    onSelectTab: (tab: MainTab) => void;
    onSelectAction: (action: ProductAction) => void;
  }>
>;

const TAB_LABELS: Readonly<Record<MainTab, string>> = {
  home: 'Home',
  events: 'Events',
  xapps: 'XApps',
  settings: 'Settings',
};

const ACTION_LABELS: Readonly<Record<ProductAction, string>> = {
  send: 'Send',
  swap: 'Swap',
  request: 'Request',
};

export function ProductShell({
  children,
  activeTab,
  actionAvailability,
  onSelectTab,
  onSelectAction,
}: Props) {
  const styles = useThemedStyles(createStyles);
  const [isActionsOpen, setActionsOpen] = useState(false);

  const renderTab = (tab: MainTab) => {
    const selected = tab === activeTab;
    return (
      <Pressable
        accessibilityRole="tab"
        accessibilityState={{selected}}
        key={tab}
        onPress={() => onSelectTab(tab)}
        style={({pressed}) => [styles.tab, pressed ? styles.pressed : undefined]}>
        <View style={[styles.tabIndicator, selected ? undefined : styles.tabIndicatorHidden]} />
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
            <Text style={styles.actionsButtonText}>+</Text>
          </Pressable>
        </View>
        {renderTab('xapps')}
        {renderTab('settings')}
      </View>

      <Modal
        animationType="fade"
        onRequestClose={() => setActionsOpen(false)}
        transparent
        visible={isActionsOpen}>
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
                      !enabled ? styles.actionItemDisabled : undefined,
                      pressed ? styles.pressed : undefined,
                    ]}>
                    <Text style={styles.actionLabel}>{ACTION_LABELS[action]}</Text>
                    {!enabled ? <Text style={styles.actionStatus}>Not available yet</Text> : null}
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
