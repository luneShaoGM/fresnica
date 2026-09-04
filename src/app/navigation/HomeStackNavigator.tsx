import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import type {AccountRecord} from '@capabilities/account/types';
import {AccountDetailsScreen} from '@features/accounts/AccountDetailsScreen';
import {AddWatchOnlyAccountScreen} from '@features/accounts/AddWatchOnlyAccountScreen';
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
          <HomeScreen
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
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="account-details">
        {({navigation, route}) => {
          const account = resolveVisibleAccount(accounts, route.params.accountId);
          return (
            <AccountDetailsScreen
              account={account}
              onBack={() => navigation.goBack()}
              onSend={() => navigation.navigate('send-form', {accountId: account.id})}
              onManageAssets={() => navigation.navigate('manage-assets', {accountId: account.id})}
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
