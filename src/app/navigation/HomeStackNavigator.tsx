import React from 'react';
import {useIsFocused} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import type {AccountRecord} from '@capabilities/account/types';
import {AddWatchOnlyAccountScreen} from '@features/accounts/AddWatchOnlyAccountScreen';
import {AssetDetailsScreen} from '@features/home/AssetDetailsScreen';
import {HomeScreen} from '@features/home/HomeScreen';
import {SendFlowScreen} from '@features/send/SendFlowScreen';
import {ManageAssetsScreen} from '@features/trustlines/ManageAssetsScreen';

import type {AppServices} from '../createAppServices';
import {resolveVisibleAccount} from './accountSelection';
import type {HomeStackParamList} from './navigationTypes';

const Stack = createNativeStackNavigator<HomeStackParamList>();

type Props = Readonly<{
  accounts: readonly AccountRecord[];
  selectedAccountId: string;
  services: AppServices;
  onAccountsChanged: () => void;
  onSwitchAccount: () => void;
}>;

export function HomeStackNavigator({
  accounts,
  selectedAccountId,
  services,
  onAccountsChanged,
  onSwitchAccount,
}: Props) {
  const selectedAccount = resolveVisibleAccount(accounts, selectedAccountId);
  const canSign = !services.onboarding.repository.isWatchOnly(selectedAccount.id);

  return (
    <Stack.Navigator initialRouteName="home" screenOptions={{headerShown: false}}>
      <Stack.Screen name="home">
        {({navigation}) => (
          <HomeRoute
            account={selectedAccount}
            accountCount={accounts.filter(account => !account.hidden).length}
            balanceDependencies={services.balance}
            canSign={canSign}
            onSwitchAccount={onSwitchAccount}
            onAddAccount={() => navigation.navigate('add-account')}
            onSend={() => navigation.navigate('send-form', {accountId: selectedAccount.id})}
            onManageAssets={() =>
              navigation.navigate('manage-assets', {accountId: selectedAccount.id})
            }
            onOpenAsset={asset =>
              navigation.navigate('asset-details', {accountId: selectedAccount.id, asset})
            }
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="asset-details">
        {({navigation, route}) => {
          const account = resolveVisibleAccount(accounts, route.params.accountId);
          return (
            <AssetDetailsRoute
              account={account}
              asset={route.params.asset}
              dependencies={services.balance}
              onBack={() => navigation.goBack()}
            />
          );
        }}
      </Stack.Screen>
      <Stack.Screen name="add-account">
        {({navigation}) => (
          <AddWatchOnlyAccountScreen
            dependencies={services.onboarding}
            onComplete={() => {
              onAccountsChanged();
              navigation.popToTop();
            }}
            onCancel={() => navigation.goBack()}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="send-form">
        {({navigation, route}) => {
          const account = resolveVisibleAccount(accounts, route.params.accountId);
          return (
            <SendFlowScreen
              account={account}
              dependencies={services.send}
              onDone={() => navigation.popToTop()}
            />
          );
        }}
      </Stack.Screen>
      <Stack.Screen name="manage-assets">
        {({navigation, route}) => {
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
