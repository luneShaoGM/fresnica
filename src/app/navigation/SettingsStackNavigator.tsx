import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { renameAccount } from '@capabilities/account/renameAccount';
import type { AccountRecord } from '@capabilities/account/types';
import { AccountDetailsScreen } from '@features/accounts/AccountDetailsScreen';
import { AccountsScreen } from '@features/accounts/AccountsScreen';
import { AddWatchOnlyAccountScreen } from '@features/accounts/AddWatchOnlyAccountScreen';
import { SecuritySettingsScreen } from '@features/security/SecuritySettingsScreen';
import { AboutScreen } from '@features/settings/AboutScreen';
import { LanguageSettingsScreen } from '@features/settings/LanguageSettingsScreen';
import { NetworkSettingsScreen } from '@features/settings/NetworkSettingsScreen';
import { SettingsHomeScreen } from '@features/settings/SettingsHomeScreen';

import { APP_CONFIG } from '../config/appConfig';
import type { AppServices } from '../createAppServices';
import type { SettingsStackParamList } from './navigationTypes';

const Stack = createNativeStackNavigator<SettingsStackParamList>();

type Props = Readonly<{
  accounts: readonly AccountRecord[];
  services: AppServices;
  onAccountsChanged: () => void;
  onSend: (accountId: string) => void;
  onManageAssets: (accountId: string) => void;
}>;

export function SettingsStackNavigator({
  accounts,
  services,
  onAccountsChanged,
  onSend,
  onManageAssets,
}: Props) {
  return (
    <Stack.Navigator initialRouteName="settings-home" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="settings-home">
        {({ navigation }) => (
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
        {({ navigation }) => (
          <AccountsScreen
            accounts={accounts}
            onBack={() => navigation.goBack()}
            onOpenAccount={accountId => navigation.navigate('account-details', { accountId })}
            onAddAccount={() => navigation.navigate('add-account')}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="account-details">
        {({ navigation, route }) => {
          const account = requireAccount(accounts, route.params.accountId);
          return (
            <AccountDetailsScreen
              account={account}
              onBack={() => navigation.goBack()}
              onRename={label => {
                renameAccount(services.accountManagement, account.id, label);
                onAccountsChanged();
              }}
              onSend={() => onSend(account.id)}
              onManageAssets={() => onManageAssets(account.id)}
            />
          );
        }}
      </Stack.Screen>
      <Stack.Screen name="add-account">
        {({ navigation }) => (
          <AddWatchOnlyAccountScreen
            dependencies={services.onboarding}
            onComplete={() => {
              navigation.goBack();
              onAccountsChanged();
            }}
            onCancel={() => navigation.goBack()}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="security-settings">
        {({ navigation }) => (
          <SecuritySettingsScreen dependencies={services.security} onClose={() => navigation.goBack()} />
        )}
      </Stack.Screen>
      <Stack.Screen name="network-settings">
        {({ navigation }) => (
          <NetworkSettingsScreen
            network={{
              id: APP_CONFIG.network.id,
              horizonUrl: APP_CONFIG.network.horizonUrl,
              isMainnet: APP_CONFIG.network.isMainnet,
            }}
            onBack={() => navigation.goBack()}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="language-settings">
        {({ navigation }) => <LanguageSettingsScreen onBack={() => navigation.goBack()} />}
      </Stack.Screen>
      <Stack.Screen name="about">
        {({ navigation }) => (
          <AboutScreen
            appName={APP_CONFIG.appName}
            projectName={APP_CONFIG.projectName}
            onBack={() => navigation.goBack()}
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

function requireAccount(accounts: readonly AccountRecord[], accountId: string): AccountRecord {
  const account = accounts.find(candidate => candidate.id === accountId);
  if (!account) {
    throw new Error('account-not-found');
  }
  return account;
}
