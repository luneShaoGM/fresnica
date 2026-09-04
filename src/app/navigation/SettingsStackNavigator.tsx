import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import type {AccountRecord} from '@capabilities/account/types';
import {AccountsScreen} from '@features/accounts/AccountsScreen';
import {SecuritySettingsScreen} from '@features/security/SecuritySettingsScreen';
import {AboutScreen} from '@features/settings/AboutScreen';
import {LanguageSettingsScreen} from '@features/settings/LanguageSettingsScreen';
import {NetworkSettingsScreen} from '@features/settings/NetworkSettingsScreen';
import {SettingsHomeScreen} from '@features/settings/SettingsHomeScreen';

import type {AppServices} from '../createAppServices';
import type {SettingsStackParamList} from './navigationTypes';

const Stack = createNativeStackNavigator<SettingsStackParamList>();

type Props = Readonly<{
  accounts: readonly AccountRecord[];
  services: AppServices;
  onOpenAccount: (accountId: string) => void;
  onAddAccount: () => void;
}>;

export function SettingsStackNavigator({accounts, services, onOpenAccount, onAddAccount}: Props) {
  return (
    <Stack.Navigator initialRouteName="settings-home" screenOptions={{headerShown: false}}>
      <Stack.Screen name="settings-home">
        {({navigation}) => (
          <SettingsHomeScreen
            accountCount={accounts.filter(account => !account.hidden).length}
            onOpenAccounts={() => navigation.navigate('accounts-settings')}
            onOpenSecurity={() => navigation.navigate('security-settings')}
            onOpenNetwork={() => navigation.navigate('network-settings')}
            onOpenLanguage={() => navigation.navigate('language-settings')}
            onOpenAbout={() => navigation.navigate('about')}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="accounts-settings">
        {({navigation}) => (
          <AccountsScreen
            accounts={accounts}
            onBack={() => navigation.goBack()}
            onOpenAccount={onOpenAccount}
            onAddAccount={onAddAccount}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="security-settings">
        {({navigation}) => (
          <SecuritySettingsScreen
            dependencies={services.security}
            onClose={() => navigation.goBack()}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="network-settings">
        {({navigation}) => <NetworkSettingsScreen onBack={() => navigation.goBack()} />}
      </Stack.Screen>
      <Stack.Screen name="language-settings">
        {({navigation}) => <LanguageSettingsScreen onBack={() => navigation.goBack()} />}
      </Stack.Screen>
      <Stack.Screen name="about">
        {({navigation}) => <AboutScreen onBack={() => navigation.goBack()} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
