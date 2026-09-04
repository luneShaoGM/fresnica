import React from 'react';
import {Image, Pressable, Text, View} from 'react-native';
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

const TAB_ICONS = {
  home: {
    idle: require('../../ui/assets/stellar/icon_tabbar_home.png'),
    selected: require('../../ui/assets/stellar/icon_tabbar_home_selected.png'),
  },
  activity: {
    idle: require('../../ui/assets/stellar/icon_tabbar_activity.png'),
    selected: require('../../ui/assets/stellar/icon_tabbar_activity_selected.png'),
  },
  dapps: {
    idle: require('../../ui/assets/stellar/icon_tabbar_dapps.png'),
    selected: require('../../ui/assets/stellar/icon_tabbar_dapps_selected.png'),
  },
  settings: {
    idle: require('../../ui/assets/stellar/icon_tabbar_settings.png'),
    selected: require('../../ui/assets/stellar/icon_tabbar_settings_selected.png'),
  },
} as const;

const ACTION_LABEL_KEYS: Readonly<Record<ProductAction, string>> = {
  send: 'nav.send',
  swap: 'nav.swap',
  request: 'nav.request',
};

const ACTION_ICONS = {
  send: require('../../ui/assets/stellar/icon_send_v2.png'),
  swap: require('../../ui/assets/stellar/icon_swap.png'),
  request: require('../../ui/assets/stellar/icon_request.png'),
} as const;

const actionsTabIcon = require('../../ui/assets/stellar/icon_tabbar_actions.png');
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
    const icon = TAB_ICONS[tab];

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
        accessibilityLabel={options.tabBarAccessibilityLabel}
        accessibilityRole="tab"
        accessibilityState={{selected: focused}}
        key={route.key}
        onLongPress={onLongPress}
        onPress={onPress}
        style={({pressed}) => [styles.tab, pressed ? styles.pressed : undefined]}>
        <Image
          resizeMode="contain"
          source={focused ? icon.selected : icon.idle}
          style={styles.tabIcon}
        />
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
            <View style={styles.sheetHandle} />
            <Text style={styles.actionsTitle}>{t('nav.actions')}</Text>
            <View style={styles.actionRow}>
              {(['send', 'swap', 'request'] as const).map(action => {
                const enabled = actionAvailability[action];
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{disabled: !enabled}}
                    disabled={!enabled}
                    key={action}
                    onPress={() => selectAction(action)}
                    style={({pressed}) => [
                      styles.actionItem,
                      action === 'swap' ? styles.actionItemStrong : styles.actionItemPrimary,
                      !enabled ? styles.actionItemDisabled : undefined,
                      pressed ? styles.pressed : undefined,
                    ]}>
                    <Image
                      resizeMode="contain"
                      source={ACTION_ICONS[action]}
                      style={styles.actionIcon}
                    />
                    <Text style={styles.actionLabel}>{t(ACTION_LABEL_KEYS[action])}</Text>
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
          style={({pressed}) => [
            styles.actionsButton,
            pressed ? styles.actionsButtonPressed : undefined,
          ]}>
          <Image resizeMode="contain" source={actionsTabIcon} style={styles.actionsImage} />
        </Pressable>
      </View>
      {renderTab(2)}
      {renderTab(3)}
    </SafeAreaView>
  );
}
