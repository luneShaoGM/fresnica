import type { NodeReadFailure } from '@capabilities/network/NodeReadError';
import { NativeButton } from '@ui/components/NativeButton';
import React, { useCallback, useEffect } from 'react';
import type { AccountSyncMode } from '@capabilities/account-sync/AccountEffects';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useThemedStyles } from '@ui/theme';

import { useLocalization } from '../../locale';
import { useOverlay } from '../OverlayHost';
import { createStyles } from './MainTabBar.styles';
import type { MainTab, ProductAction } from './productRoutes';

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
    selectedAccountId?: string;
    syncMode?: AccountSyncMode;
    nodePhase?: 'checking' | 'healthy' | 'cooldown' | 'wrong-network' | 'paused' | 'closed';
    nodeFailure?: NodeReadFailure;
    onRetryNode?: () => void;
    actionAvailability: Readonly<Record<ProductAction, boolean>>;
    actionState?: 'inactive' | 'checking' | 'unavailable';
  }>;

export function MainTabBar({
  state,
  descriptors,
  navigation,
  selectedAccountId,
  actionAvailability,
  actionState,
  nodePhase,
  nodeFailure,
  onRetryNode,
}: MainTabBarProps) {
  const { t } = useLocalization();
  const styles = useThemedStyles(createStyles);
  const { activeOverlayId, present, dismiss } = useOverlay();

  const activeRoute = state.routes[state.index];
  const activeTab = activeRoute.name as MainTab;
  const focusedChildRoute = getFocusedRouteNameFromRoute(activeRoute);

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
      navigation.emit({ type: 'tabLongPress', target: route.key });
    };

    return (
      <Pressable
        accessibilityLabel={options.tabBarAccessibilityLabel ?? t(TAB_LABEL_KEYS[tab])}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        key={route.key}
        onLongPress={onLongPress}
        onPress={onPress}
        style={({ pressed }) => [styles.tab, pressed ? styles.pressed : undefined]}
      >
        <Text style={[styles.tabText, focused ? styles.selectedTabText : undefined]}>{t(TAB_LABEL_KEYS[tab])}</Text>
      </Pressable>
    );
  };

  const selectAction = useCallback(
    (action: ProductAction) => {
      if (!selectedAccountId || !actionAvailability[action]) {
        return;
      }
      dismiss();
      if (action === 'send') {
        navigation.navigate('home', {
          screen: 'send-form',
          params: { accountId: selectedAccountId },
        });
      }
      if (action === 'swap') {
        navigation.navigate('home', {
          screen: 'swap',
          params: { accountId: selectedAccountId },
        });
      }
      if (action === 'request') {
        navigation.navigate('home', {
          screen: 'request',
          params: { accountId: selectedAccountId },
        });
      }
    },
    [actionAvailability, dismiss, navigation, selectedAccountId],
  );

  const openActions = useCallback(() => {
    if (!selectedAccountId) {
      dismiss();
      return;
    }
    present(
      ACTIONS_OVERLAY_ID,
      <ScrollView bounces={false} style={styles.actionsScroll} contentContainerStyle={styles.actionsContent}>
        <View style={styles.actionsHeader}>
          <Text accessibilityRole="header" style={styles.actionsTitle}>
            {t('nav.actions')}
          </Text>
          <Pressable
            accessibilityLabel={t('nav.actionsClose')}
            accessibilityRole="button"
            onPress={dismiss}
            style={styles.closeButton}
          >
            <Text style={styles.actionLabel}>{t('nav.actionsClose')}</Text>
          </Pressable>
        </View>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          {t('nav.quickActions')}
        </Text>
        <View style={styles.actionRow}>
          {(['send', 'swap', 'request'] as const).map(action => {
            const enabled = !!selectedAccountId && actionAvailability[action];
            const label = t(ACTION_LABEL_KEYS[action]);
            return (
              <Pressable
                accessibilityLabel={label}
                accessibilityRole="button"
                accessibilityState={{ disabled: !enabled }}
                disabled={!enabled}
                key={action}
                onPress={() => selectAction(action)}
                style={({ pressed }) => [
                  styles.actionItem,
                  !enabled ? styles.actionItemDisabled : undefined,
                  pressed ? styles.pressed : undefined,
                ]}
              >
                <Text style={styles.actionLabel}>{label}</Text>
                {!enabled ? (
                  <Text style={styles.actionStatus}>
                    {t(
                      action === 'request' || !actionState
                        ? 'nav.comingSoon'
                        : actionState === 'inactive'
                          ? 'nav.accountInactive'
                          : actionState === 'checking'
                            ? 'nav.accountChecking'
                            : 'nav.accountUnavailable',
                    )}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
        <Pressable
          accessibilityLabel={t('actions.scan')}
          accessibilityRole="button"
          onPress={() => {
            if (!selectedAccountId) return;
            dismiss();
            navigation.navigate('home', {
              screen: 'request',
              params: { accountId: selectedAccountId, initialScan: true },
            });
          }}
          style={({ pressed }) => [styles.scanAction, pressed ? styles.pressed : undefined]}
        >
          <Text style={styles.scanActionLabel}>{t('actions.scan')}</Text>
        </Pressable>
      </ScrollView>,
      {
        statusBarContent: 'light',
        presentation: 'sheet',
        closeLabel: t('nav.actionsClose'),
        dragDismissLabel: t('nav.actionsDragClose'),
      },
    );
  }, [actionAvailability, actionState, dismiss, navigation, present, selectedAccountId, styles, t, selectAction]);

  useEffect(() => {
    if (activeOverlayId === ACTIONS_OVERLAY_ID) openActions();
  }, [activeOverlayId, openActions]);

  if (focusedChildRoute && focusedChildRoute !== ROOT_ROUTE_BY_TAB[activeTab]) return null;

  return (
    <View>
      {nodePhase === 'cooldown' || nodePhase === 'wrong-network' ? (
        <View style={styles.nodeNotice}>
          <Text accessibilityLiveRegion="polite" style={styles.syncNotice}>
            {t(
              nodePhase === 'wrong-network'
                ? 'node.read.wrongNetwork'
                : nodeFailure === 'rate-limited'
                  ? 'node.read.rateLimited'
                  : 'node.read.unavailable',
            )}
          </Text>
          {onRetryNode ? (
            <NativeButton label={t('node.read.retry')} onPress={onRetryNode} size="sm" variant="secondary" />
          ) : null}
        </View>
      ) : null}
      <SafeAreaView edges={['right', 'bottom', 'left']} style={styles.tabBar}>
        {renderTab(0)}
        {renderTab(1)}
        <View style={styles.actionsSlot}>
          <Pressable
            accessibilityLabel={t('nav.actions')}
            accessibilityRole="button"
            accessibilityState={{ expanded: activeOverlayId === ACTIONS_OVERLAY_ID, disabled: !selectedAccountId }}
            disabled={!selectedAccountId}
            onPress={openActions}
            style={({ pressed }) => [
              styles.actionsButton,
              !selectedAccountId ? styles.actionItemDisabled : undefined,
              pressed ? styles.pressed : undefined,
            ]}
          >
            <Text accessibilityElementsHidden style={styles.actionsPlus}>
              +
            </Text>
            <Text style={styles.actionsLabel}>{t('nav.actions')}</Text>
          </Pressable>
        </View>
        {renderTab(2)}
        {renderTab(3)}
      </SafeAreaView>
    </View>
  );
}
