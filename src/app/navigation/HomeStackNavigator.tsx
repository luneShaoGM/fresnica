import React, { useSyncExternalStore } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import type { AccountRecord } from '@capabilities/account/types';
import { AddAccountScreen } from '@features/accounts/AddAccountScreen';
import { AssetDetailsScreen } from '@features/home/AssetDetailsScreen';
import { HomeScreen } from '@features/home/HomeScreen';
import { SendFlowScreen } from '@features/send/SendFlowScreen';
import { RequestFlowScreen } from '@features/request/RequestFlowScreen';
import { ManageAssetsScreen } from '@features/trustlines/ManageAssetsScreen';
import { ReactNativeRequestQrScannerView } from '@platform/system/RequestQrScannerView';

import type { AppServices } from '../createAppServices';
import { resolveVisibleAccount } from './accountSelection';
import type { HomeStackParamList } from './navigationTypes';

const Stack = createNativeStackNavigator<HomeStackParamList>();

type Props = Readonly<{
  accounts: readonly AccountRecord[];
  selectedAccountId: string;
  selectableAccounts: readonly AccountRecord[];
  services: AppServices;
  onAccountsChanged: () => void;
  onCreatedAccountReady: (accountId: string) => void | Promise<void>;
  onSelectAccount: (accountId: string) => void | Promise<void>;
}>;

export function HomeStackNavigator({
  accounts,
  selectedAccountId,
  selectableAccounts,
  services,
  onAccountsChanged,
  onCreatedAccountReady,
  onSelectAccount,
}: Props) {
  const selectedAccount = resolveVisibleAccount(accounts, selectedAccountId);
  const canSign = !services.onboarding.repository.isWatchOnly(selectedAccount.id);
  const invalidationRevision = useSyncExternalStore(
    services.ledgerReadInvalidation.subscribe,
    () => services.ledgerReadInvalidation.getRevision(selectedAccount.networkId, selectedAccount.id),
    () => 0,
  );

  return (
    <Stack.Navigator initialRouteName="home" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="home">
        {({ navigation }) => (
          <HomeRoute
            account={selectedAccount}
            accountCount={selectableAccounts.length}
            selectableAccounts={selectableAccounts}
            balanceDependencies={services.balance}
            friendbotDependencies={services.friendbot}
            canSign={canSign}
            onSelectAccount={onSelectAccount}
            onAddAccount={() => navigation.navigate('add-account')}
            onSend={() => navigation.navigate('send-form', { accountId: selectedAccount.id })}
            onRequest={
              selectedAccount.identityKind === 'classic'
                ? () => navigation.navigate('request', { accountId: selectedAccount.id })
                : undefined
            }
            onManageAssets={() => navigation.navigate('manage-assets', { accountId: selectedAccount.id })}
            onOpenAsset={asset => navigation.navigate('asset-details', { accountId: selectedAccount.id, asset })}
            onManualRefresh={() => services.transactionRecovery.reconcile('manual-refresh')}
            invalidationRevision={invalidationRevision}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="asset-details">
        {({ navigation, route }) => {
          const account = resolveVisibleAccount(accounts, route.params.accountId);
          return (
            <AssetDetailsRoute
              account={account}
              asset={route.params.asset}
              dependencies={services.balance}
              invalidationRevision={invalidationRevision}
              onBack={() => navigation.goBack()}
            />
          );
        }}
      </Stack.Screen>
      <Stack.Screen name="add-account">
        {({ navigation }) => (
          <AddAccountScreen
            dependencies={services.onboarding}
            onAccountPersisted={onAccountsChanged}
            onCreatedAccountReady={async accountId => {
              await onCreatedAccountReady(accountId);
              navigation.popToTop();
            }}
            onWatchOnlyComplete={() => {
              onAccountsChanged();
              navigation.popToTop();
            }}
            onCancel={() => navigation.goBack()}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="send-form">
        {({ navigation, route }) => {
          const account = resolveVisibleAccount(accounts, route.params.accountId);
          return <SendFlowScreen account={account} dependencies={services.send} onDone={() => navigation.popToTop()} />;
        }}
      </Stack.Screen>
      <Stack.Screen name="request">
        {({ navigation, route }) => {
          const account = resolveVisibleAccount(accounts, route.params.accountId);
          return (
            <RequestFlowScreen
              account={account}
              dependencies={services.request}
              onDone={() => navigation.popToTop()}
              ScannerView={ReactNativeRequestQrScannerView}
            />
          );
        }}
      </Stack.Screen>
      <Stack.Screen name="manage-assets">
        {({ navigation, route }) => {
          const account = resolveVisibleAccount(accounts, route.params.accountId);
          return (
            <ManageAssetsScreen
              account={account}
              dependencies={services.trustline}
              onDone={() => navigation.popToTop()}
            />
          );
        }}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

function HomeRoute(props: Omit<React.ComponentProps<typeof HomeScreen>, 'active'>) {
  const active = useIsFocused();
  return <HomeScreen {...props} active={active} />;
}

function AssetDetailsRoute(props: Omit<React.ComponentProps<typeof AssetDetailsScreen>, 'active'>) {
  const active = useIsFocused();
  return <AssetDetailsScreen {...props} active={active} />;
}
