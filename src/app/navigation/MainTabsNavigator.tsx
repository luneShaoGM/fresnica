import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import type { AccountRecord } from '@capabilities/account/types';

import type { AppServices } from '../createAppServices';
import {
  persistResolvedDefaultAccountId,
  reconcileVisibleAccountId,
  resolvePreferredVisibleAccountId,
  resolveVisibleAccount,
  selectAndPersistDefaultAccountId,
  selectPersistedAccountAndDefault,
  selectableAccountsForNetwork,
} from './accountSelection';
import { ActivityStackNavigator } from './ActivityStackNavigator';
import { DAppsStackNavigator } from './DAppsStackNavigator';
import { HomeStackNavigator } from './HomeStackNavigator';
import { MainTabBar } from './MainTabBar';
import { createSwapSelectionStore } from './swapSelectionStore';
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
        onCreatedAccountReady={async accountId => {
          try {
            selectPersistedAccountAndDefault(
              services.onboarding.repository,
              accountId,
              networkId,
              services.accountSelectionPreferences,
            );
          } catch (error) {
            services.diagnostics.warn('default-account-persistence-failed', {
              details: { networkId, accountId, error },
            });
            throw new Error('default-account-persistence-failed');
          }
          onAccountsChanged();
        }}
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
  const selectionStoreRef = useRef<ReturnType<typeof createSwapSelectionStore> | undefined>(undefined);
  if (selectionStoreRef.current === undefined) {
    selectionStoreRef.current = createSwapSelectionStore();
  }
  const swapSelectionStore = selectionStoreRef.current;
  useLayoutEffect(() => {
    // Publish only committed selection/inventory changes; never notify a
    // subscribed Swap route during another React component's render.
    swapSelectionStore.update({
      selectedAccountId: effectiveSelectedAccountId,
      accounts,
      network: services.send.network,
    });
  }, [accounts, effectiveSelectedAccountId, services.send.network, swapSelectionStore]);
  useEffect(() => () => swapSelectionStore.invalidate(), [swapSelectionStore]);
  const getCurrentSwapSelection = useCallback(() => swapSelectionStore.getCurrentSelection(), [swapSelectionStore]);

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
        if (persistedAccountId !== swapSelectionStore.getCurrentSelection()?.selectedAccountId) {
          // Persisted selection is authoritative now, even if React has not
          // rendered the new route props yet (A→B→A in one tick).
          swapSelectionStore.update({
            selectedAccountId: persistedAccountId,
            accounts,
            network: services.send.network,
          });
          setSelectedAccountId(persistedAccountId);
        }
      } catch (error) {
        services.diagnostics.warn('default-account-persistence-failed', {
          details: { networkId, accountId, error },
        });
        throw new Error('default-account-persistence-failed');
      }
    },
    [accounts, networkId, services, swapSelectionStore],
  );

  const completeCreatedAccount = useCallback(
    async (accountId: string) => {
      try {
        const persistedAccountId = selectPersistedAccountAndDefault(
          services.onboarding.repository,
          accountId,
          networkId,
          services.accountSelectionPreferences,
        );
        swapSelectionStore.update({
          selectedAccountId: persistedAccountId,
          accounts,
          network: services.send.network,
        });
        setSelectedAccountId(persistedAccountId);
      } catch (error) {
        services.diagnostics.warn('default-account-persistence-failed', {
          details: { networkId, accountId, error },
        });
        throw new Error('default-account-persistence-failed');
      }
      onAccountsChanged();
    },
    [accounts, networkId, onAccountsChanged, services, swapSelectionStore],
  );

  const renderDApps = useCallback(
    () => <DAppsStackNavigator catalog={services.dappCatalog} openExternalUrl={services.externalUrl.open} />,
    [services.dappCatalog, services.externalUrl],
  );

  const selectedAccount = resolveVisibleAccount(accounts, effectiveSelectedAccountId);
  const canSign = !services.onboarding.repository.isWatchOnly(selectedAccount.id);
  const actionAvailability = useMemo<Readonly<Record<ProductAction, boolean>>>(
    () => ({
      send: selectedAccount.identityKind === 'classic' && canSign,
      // Preview-only: no authorization or submission UI in this slice.
      swap: selectedAccount.identityKind === 'classic' && canSign,
      request: selectedAccount.identityKind === 'classic',
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
            onCreatedAccountReady={completeCreatedAccount}
            onSelectAccount={selectAccount}
            selectableAccounts={selectableAccounts}
            selectedAccountId={effectiveSelectedAccountId}
            getCurrentSwapSelection={getCurrentSwapSelection}
            subscribeToSwapSelection={swapSelectionStore.subscribe}
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
      <Tab.Screen name="dapps">{renderDApps}</Tab.Screen>
      <Tab.Screen name="settings">
        {({ navigation }) => (
          <SettingsStackNavigator
            accounts={accounts}
            services={services}
            onAccountsChanged={onAccountsChanged}
            onCreatedAccountReady={completeCreatedAccount}
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
