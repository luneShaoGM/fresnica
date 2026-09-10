import React from 'react';
import {Pressable, Text, View} from 'react-native';
import type {BottomTabBarProps} from '@react-navigation/bottom-tabs';
import {getFocusedRouteNameFromRoute} from '@react-navigation/native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {useThemedStyles} from '@ui/theme';

import {useLocalization} from '../../locale';
import {useOverlay} from '../OverlayHost';
import {createStyles} from './MainTabBar.styles';
import type {MainTab, ProductAction} from './productRoutes';

const TAB_LABEL_KEYS: Readonly<Record<MainTab, string>> = {
  home: 'nav.home',
  activity: 'nav.activity',
  dapps: 'nav.dapps',
  settings: 'nav.settings',
};

const ROOT_ROUTE_BY_TAB: Readonly<Record<MainTab, string>> = {
  home: 'home',
  activity: 'activity',
  dapps: 'dapps',
  settings: 'settings-home',
};

const ACTION_LABEL_KEYS: Readonly<Record<ProductAction, string>> = {
  send: 'nav.send',
  swap: 'nav.swap',
  request: 'nav.request',
};

const ACTIONS_OVERLAY_ID = 'actions';

export type MainTabBarProps = BottomTabBarProps &
  Readonly<{
    selectedAccountId: string;
    actionAvailability: Readonly<Record<ProductAction, boolean>>;
  }>;

export function MainTabBar({
  state,
  descriptors,
  navigation,
  selectedAccountId,
  actionAvailability,
}: MainTabBarProps) {
  const {t} = useLocalization();
  const styles = useThemedStyles(createStyles);
  const {activeOverlayId, present, dismiss} = useOverlay();

  const activeRoute = state.routes[state.index];
  const activeTab = activeRoute.name as MainTab;
  const focusedChildRoute = getFocusedRouteNameFromRoute(activeRoute);
  if (focusedChildRoute && focusedChildRoute !== ROOT_ROUTE_BY_TAB[activeTab]) {
    return null;
  }

  const renderTab = (index: number) => {
    const route = state.routes[index];
    const tab = route.name as MainTab;
    const focused = state.index === index;
    const options = descriptors[route.key].options;

    const onPress = () => {
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });

      if (!focused && !event.defaultPrevented) {
        navigation.navigate(route.name);
      }
    };

    const onLongPress = () => {
      navigation.emit({type: 'tabLongPress', target: route.key});
    };

    return (
      <Pressable
        accessibilityLabel={options.tabBarAccessibilityLabel ?? t(TAB_LABEL_KEYS[tab])}
        accessibilityRole="tab"
        accessibilityState={{selected: focused}}
        key={route.key}
        onLongPress={onLongPress}
        onPress={onPress}
        style={({pressed}) => [styles.tab, pressed ? styles.pressed : undefined]}>
        <Text style={[styles.tabText, focused ? styles.selectedTabText : undefined]}>
          {t(TAB_LABEL_KEYS[tab])}
        </Text>
      </Pressable>
    );
  };

  const selectAction = (action: ProductAction) => {
    if (!actionAvailability[action]) {
      return;
    }
    dismiss();
    if (action === 'send') {
      navigation.navigate('home', {
        screen: 'send-form',
        params: {accountId: selectedAccountId},
      });
    }
  };

  const openActions = () => {
    present(
      ACTIONS_OVERLAY_ID,
      <Pressable style={styles.overlay} onPress={dismiss}>
        <Pressable onPress={event => event.stopPropagation()}>
          <SafeAreaView edges={['right', 'bottom', 'left']} style={styles.actionsSheet}>
            <Text style={styles.actionsTitle}>{t('nav.actions')}</Text>
            <View style={styles.actionRow}>
              {(['send', 'swap', 'request'] as const).map(action => {
                const enabled = actionAvailability[action];
                const label = t(ACTION_LABEL_KEYS[action]);
                return (
                  <Pressable
                    accessibilityLabel={label}
                    accessibilityRole="button"
                    accessibilityState={{disabled: !enabled}}
                    disabled={!enabled}
                    key={action}
                    onPress={() => selectAction(action)}
                    style={({pressed}) => [
                      styles.actionItem,
                      !enabled ? styles.actionItemDisabled : undefined,
                      pressed ? styles.pressed : undefined,
                    ]}>
                    <Text style={styles.actionLabel}>{label}</Text>
                    {!enabled ? <Text style={styles.actionStatus}>{t('nav.comingSoon')}</Text> : null}
                  </Pressable>
                );
              })}
            </View>
          </SafeAreaView>
        </Pressable>
      </Pressable>,
      {statusBarContent: 'light'},
    );
  };

  return (
    <SafeAreaView edges={['right', 'bottom', 'left']} style={styles.tabBar}>
      {renderTab(0)}
      {renderTab(1)}
      <View style={styles.actionsSlot}>
        <Pressable
          accessibilityLabel={t('nav.actions')}
          accessibilityRole="button"
          accessibilityState={{expanded: activeOverlayId === ACTIONS_OVERLAY_ID}}
          onPress={openActions}
          style={({pressed}) => [styles.actionsButton, pressed ? styles.pressed : undefined]}>
          <Text accessibilityElementsHidden style={styles.actionsPlus}>+</Text>
          <Text style={styles.actionsLabel}>{t('nav.actions')}</Text>
        </Pressable>
      </View>
      {renderTab(2)}
      {renderTab(3)}
    </SafeAreaView>
  );
}
