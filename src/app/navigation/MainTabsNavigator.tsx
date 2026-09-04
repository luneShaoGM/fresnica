import React, {useEffect, useMemo, useState} from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';

import type {AccountRecord} from '@capabilities/account/types';

import type {AppServices} from '../createAppServices';
import {
  firstVisibleAccountId,
  nextVisibleAccountId,
  reconcileVisibleAccountId,
  resolveVisibleAccount,
} from './accountSelection';
import {ActivityStackNavigator} from './ActivityStackNavigator';
import {DAppsStackNavigator} from './DAppsStackNavigator';
import {HomeStackNavigator} from './HomeStackNavigator';
import {MainTabBar} from './MainTabBar';
import type {MainTabParamList} from './navigationTypes';
import type {ProductAction} from './productRoutes';
import {SettingsStackNavigator} from './SettingsStackNavigator';

const Tab = createBottomTabNavigator<MainTabParamList>();

type Props = Readonly<{
  accounts: readonly AccountRecord[];
  services: AppServices;
  onAccountsChanged: () => void;
}>;

export function MainTabsNavigator({accounts, services, onAccountsChanged}: Props) {
  const [selectedAccountId, setSelectedAccountId] = useState(() => firstVisibleAccountId(accounts));

  const effectiveSelectedAccountId = reconcileVisibleAccountId(accounts, selectedAccountId);

  useEffect(() => {
    if (effectiveSelectedAccountId !== selectedAccountId) {
      setSelectedAccountId(effectiveSelectedAccountId);
    }
  }, [effectiveSelectedAccountId, selectedAccountId]);

  const selectedAccount = resolveVisibleAccount(accounts, effectiveSelectedAccountId);
  const canSign = !services.onboarding.repository.isWatchOnly(selectedAccount.id);
  const actionAvailability = useMemo<Readonly<Record<ProductAction, boolean>>>(
    () => ({
      send: selectedAccount.identityKind === 'classic' && canSign,
      swap: false,
      request: false,
    }),
    [canSign, selectedAccount.identityKind],
  );

  return (
    <Tab.Navigator
      backBehavior="history"
      initialRouteName="home"
      screenOptions={{headerShown: false}}
      tabBar={props => (
        <MainTabBar
          {...props}
          actionAvailability={actionAvailability}
          selectedAccountId={effectiveSelectedAccountId}
        />
      )}>
      <Tab.Screen name="home">
        {() => (
          <HomeStackNavigator
            accounts={accounts}
            onAccountsChanged={onAccountsChanged}
            onSwitchAccount={() =>
              setSelectedAccountId(current => nextVisibleAccountId(accounts, current))
            }
            selectedAccountId={effectiveSelectedAccountId}
            services={services}
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="activity">
        {() => (
          <ActivityStackNavigator
            accounts={accounts}
            selectedAccountId={effectiveSelectedAccountId}
            services={services}
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="dapps" component={DAppsStackNavigator} />
      <Tab.Screen name="settings">
        {({navigation}) => (
          <SettingsStackNavigator
            accounts={accounts}
            services={services}
            onOpenAccount={accountId =>
              navigation.navigate('home', {
                screen: 'account-details',
                params: {accountId},
              })
            }
            onAddAccount={() => navigation.navigate('home', {screen: 'add-account'})}
          />
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
}
