import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import type { AccountRecord } from '@capabilities/account/types';

import type { AppServices } from '../createAppServices';
import {
  persistResolvedDefaultAccountId,
  reconcileVisibleAccountId,
  resolvePreferredVisibleAccountId,
  resolveVisibleAccount,
  selectAndPersistDefaultAccountId,
  selectableAccountsForNetwork,
} from './accountSelection';
import { ActivityStackNavigator } from './ActivityStackNavigator';
import { DAppsStackNavigator } from './DAppsStackNavigator';
import { HomeStackNavigator } from './HomeStackNavigator';
import { MainTabBar } from './MainTabBar';
import type { MainTabParamList } from './navigationTypes';
import type { ProductAction } from './productRoutes';
import { SettingsStackNavigator } from './SettingsStackNavigator';

const Tab = createBottomTabNavigator<MainTabParamList>();

type Props = Readonly<{
  accounts: readonly AccountRecord[];
  services: AppServices;
  onAccountsChanged: () => void;
}>;

export function MainTabsNavigator({ accounts, services, onAccountsChanged }: Props) {
  const networkId = services.onboarding.networkId;
  const networkAccounts = useMemo(
    () => accounts.filter(account => account.networkId === networkId),
    [accounts, networkId],
  );
  const selectableAccounts = useMemo(() => selectableAccountsForNetwork(accounts, networkId), [accounts, networkId]);

  if (selectableAccounts.length === 0) {
    return (
      <SettingsStackNavigator
        accounts={networkAccounts}
        services={services}
        onAccountsChanged={onAccountsChanged}
        onSend={() => undefined}
        onManageAssets={() => undefined}
      />
    );
  }

  return (
    <MainTabsWithSelection
      accounts={accounts}
      networkId={networkId}
      onAccountsChanged={onAccountsChanged}
      selectableAccounts={selectableAccounts}
      services={services}
    />
  );
}

type MainTabsWithSelectionProps = Props &
  Readonly<{
    networkId: string;
    selectableAccounts: readonly AccountRecord[];
  }>;

function MainTabsWithSelection({
  accounts,
  networkId,
  onAccountsChanged,
  selectableAccounts,
  services,
}: MainTabsWithSelectionProps) {
  const [selectedAccountId, setSelectedAccountId] = useState(() => {
    let preferredAccountId: string | undefined;
    try {
      preferredAccountId = services.accountSelectionPreferences.getDefaultAccountId(networkId);
    } catch (error) {
      services.diagnostics.warn('default-account-read-failed', {
        details: { networkId, error },
      });
    }
    return resolvePreferredVisibleAccountId(accounts, networkId, preferredAccountId) ?? selectableAccounts[0].id;
  });
  const previousAccountsRef = useRef(accounts);

  const effectiveSelectedAccountId = reconcileVisibleAccountId(
    accounts,
    selectedAccountId,
    previousAccountsRef.current,
    networkId,
  );

  useEffect(() => {
    if (effectiveSelectedAccountId !== selectedAccountId) {
      setSelectedAccountId(effectiveSelectedAccountId);
    }
    previousAccountsRef.current = accounts;

    try {
      persistResolvedDefaultAccountId(services.accountSelectionPreferences, networkId, effectiveSelectedAccountId);
    } catch (error) {
      services.diagnostics.warn('default-account-persistence-failed', {
        details: { networkId, accountId: effectiveSelectedAccountId, error },
      });
    }
  }, [accounts, effectiveSelectedAccountId, networkId, selectedAccountId, services]);

  const selectAccount = useCallback(
    async (accountId: string) => {
      try {
        const persistedAccountId = selectAndPersistDefaultAccountId(
          accounts,
          accountId,
          networkId,
          services.accountSelectionPreferences,
        );
        if (persistedAccountId !== effectiveSelectedAccountId) {
          setSelectedAccountId(persistedAccountId);
        }
      } catch (error) {
        services.diagnostics.warn('default-account-persistence-failed', {
          details: { networkId, accountId, error },
        });
        throw new Error('default-account-persistence-failed');
      }
    },
    [accounts, effectiveSelectedAccountId, networkId, services],
  );

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
      screenOptions={{ headerShown: false }}
      tabBar={props => (
        <MainTabBar {...props} actionAvailability={actionAvailability} selectedAccountId={effectiveSelectedAccountId} />
      )}
    >
      <Tab.Screen name="home">
        {() => (
          <HomeStackNavigator
            accounts={accounts}
            onAccountsChanged={onAccountsChanged}
            onSelectAccount={selectAccount}
            selectableAccounts={selectableAccounts}
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
        {({ navigation }) => (
          <SettingsStackNavigator
            accounts={accounts}
            services={services}
            onAccountsChanged={onAccountsChanged}
            onSend={accountId => navigation.navigate('home', { screen: 'send-form', params: { accountId } })}
            onManageAssets={accountId =>
              navigation.navigate('home', { screen: 'manage-assets', params: { accountId } })
            }
          />
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
}
