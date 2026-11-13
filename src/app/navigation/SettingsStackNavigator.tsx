import { ThemeSettingsScreen } from '@features/settings/ThemeSettingsScreen/ThemeSettingsScreen';
import { SessionLogsScreen } from '@features/settings/SessionLogsScreen/SessionLogsScreen';
import { Linking, Share } from 'react-native';
import { RecoveryMaterialScreen } from '@features/security/RecoveryManagement/RecoveryMaterialScreen';
import { ChangePassphraseScreen } from '@features/security/RecoveryManagement/ChangePassphraseScreen';
import { createSensitiveClipboard } from '@platform/system/sensitiveClipboard';
import React, { useMemo } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { moveAccount, orderAccounts } from '@capabilities/account/accountOrder';
import { setAccountHidden } from '@capabilities/account/accountVisibility';
import { deleteLocalAccount } from '@capabilities/account/deleteLocalAccount';
import { renameAccount } from '@capabilities/account/renameAccount';
import type { AccountRecord } from '@capabilities/account/types';
import { AddressBookScreen } from '@features/contacts/AddressBookScreen';
import { ReactNativeRequestQrScannerView } from '@platform/system/RequestQrScannerView';
import { reactNativeRequestIngress } from '@platform/system/requestIngress';
import { AccountDetailsScreen } from '@features/accounts/AccountDetailsScreen';
import { AccountsScreen } from '@features/accounts/AccountsScreen';
import { AddAccountScreen } from '@features/accounts/AddAccountScreen';
import { SecuritySettingsScreen } from '@features/security/SecuritySettingsScreen';
import { TermsScreen } from '@features/settings/TermsScreen';
import { AboutScreen } from '@features/settings/AboutScreen';
import { LanguageSettingsScreen } from '@features/settings/LanguageSettingsScreen';
import { NetworkSettingsScreen } from '@features/settings/NetworkSettingsScreen';
import { SettingsHomeScreen } from '@features/settings/SettingsHomeScreen';
import { GeneralSettingsScreen } from '@features/settings/GeneralSettingsScreen';
import { PrivacySettingsScreen } from '@features/settings/PrivacySettingsScreen';
import { AdvancedSettingsScreen } from '@features/settings/AdvancedSettingsScreen';
import { ConnectedDappsScreen } from '@features/dapps/screens/ConnectedDappsScreen';

import { APP_CONFIG } from '../config/appConfig';
import type { AppServices } from '../createAppServices';
import type { SettingsStackParamList } from './navigationTypes';

const Stack = createNativeStackNavigator<SettingsStackParamList>();

type Props = Readonly<{
  accounts: readonly AccountRecord[];
  services: AppServices;
  onAccountsChanged: () => void;
  onCreatedAccountReady: (accountId: string) => void | Promise<void>;
  onSend: (accountId: string) => void;
  onManageAssets: (accountId: string) => void;
}>;

export function SettingsStackNavigator({
  accounts,
  services,
  onAccountsChanged,
  onCreatedAccountReady,
  onSend,
  onManageAssets,
}: Props) {
  const visibleAccountCount = accounts.filter(account => !account.hidden).length;
  const orderedAccountList = orderAccounts(accounts);

  return (
    <Stack.Navigator initialRouteName="settings-home" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="settings-home">
        {({ navigation }) => (
          <SettingsHomeScreen
            accountCount={accounts.length}
            onOpenAccounts={() => navigation.navigate('accounts-settings')}
            onOpenAddressBook={() => navigation.navigate('address-book')}
            onOpenSecurity={() => navigation.navigate('security-settings')}
            onOpenPrivacy={() => navigation.navigate('privacy-settings')}
            onOpenConnectedDapps={() => navigation.navigate('connected-dapps')}
            onOpenGeneral={() => navigation.navigate('general-settings')}
            onOpenAdvanced={() => navigation.navigate('advanced-settings')}
            onOpenSupport={() => openSupportWebsite(navigation)}
            onOpenTerms={() => navigation.navigate('terms')}
            onOpenAbout={() => navigation.navigate('about')}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="address-book">
        {({ navigation }) => (
          <AddressBookRoute
            key={services.contacts.network.id}
            book={services.contacts}
            scanner={{ ScannerView: ReactNativeRequestQrScannerView, ingress: reactNativeRequestIngress }}
            onBack={() => navigation.goBack()}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="general-settings">
        {({ navigation }) => (
          <GeneralSettingsRoute
            quotes={services.xlmQuotes}
            onBack={() => navigation.goBack()}
            onOpenLanguage={() => navigation.navigate('language-settings')}
            onOpenTheme={() => navigation.navigate('theme-settings')}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="advanced-settings">
        {({ navigation }) => (
          <AdvancedSettingsScreen
            appVersion={APP_CONFIG.appVersion}
            sessionId={services.diagnostics.sessionId}
            settings={services.networkSettings}
            onBack={() => navigation.goBack()}
            onOpenNetwork={() => navigation.navigate('network-settings')}
            onOpenAbout={() => navigation.navigate('about')}
            onOpenLogs={() => navigation.navigate('session-logs')}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="theme-settings" listeners={{ beforeRemove: () => services.themeImageSelection?.cancel() }}>
        {({ navigation }) => (
          <ThemeSettingsRoute selection={services.themeImageSelection} onBack={() => navigation.goBack()} />
        )}
      </Stack.Screen>
      <Stack.Screen name="session-logs">
        {({ navigation }) =>
          services.networkSettings ? (
            <SessionLogsRoute
              source={services.diagnostics}
              settings={services.networkSettings}
              onBack={() => navigation.goBack()}
            />
          ) : null
        }
      </Stack.Screen>
      <Stack.Screen name="accounts-settings">
        {({ navigation }) => (
          <AccountsScreen
            accounts={orderedAccountList}
            onBack={() => navigation.goBack()}
            onOpenAccount={accountId => navigation.navigate('account-details', { accountId })}
            onAddAccount={() => navigation.navigate('add-account')}
            onMoveAccount={(accountId, direction) => {
              moveAccount(services.accountManagement, accountId, direction);
              onAccountsChanged();
            }}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="account-details">
        {({ navigation, route }) => {
          const account = requireAccount(accounts, route.params.accountId);
          return (
            <AccountDetailsRoute
              account={account}
              canHide={account.hidden || visibleAccountCount > 1}
              onOpenRecovery={services.recoveryManagement ? () => navigation.navigate('recovery-material', { accountId: account.id }) : undefined}
              onBack={() => navigation.goBack()}
              onRename={label => {
                renameAccount(services.accountManagement, account.id, label);
                onAccountsChanged();
              }}
              onToggleHidden={() => {
                setAccountHidden(services.accountManagement, account.id, !account.hidden);
                onAccountsChanged();
              }}
              onDelete={() => {
                deleteLocalAccount(services.accountManagement, account.id);
                navigation.popToTop();
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
          <AddAccountScreen
            dependencies={services.onboarding}
            onAccountPersisted={onAccountsChanged}
            onCreatedAccountReady={async accountId => {
              await onCreatedAccountReady(accountId);
              navigation.goBack();
            }}
            onWatchOnlyComplete={() => {
              navigation.goBack();
              onAccountsChanged();
            }}
            onCancel={() => navigation.goBack()}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="security-settings">
        {({ navigation }) => <SecuritySettingsScreen onClose={() => navigation.goBack()} accounts={accounts} onChangePassphrase={services.recoveryManagement ? () => navigation.navigate('change-passphrase') : undefined} onOpenRecovery={services.recoveryManagement ? accountId => navigation.navigate('recovery-material', { accountId }) : undefined} />}
      </Stack.Screen>
      <Stack.Screen name="recovery-material">
        {({ navigation, route }) => services.recoveryManagement ? <RecoveryMaterialRoute dependencies={services.recoveryManagement} accountId={route.params.accountId} onBack={() => navigation.goBack()} /> : null}
      </Stack.Screen>
      <Stack.Screen name="change-passphrase">
        {({ navigation }) => services.recoveryManagement ? <ChangePassphraseRoute dependencies={services.recoveryManagement} onBack={() => navigation.goBack()} onChanged={() => { navigation.popToTop(); services.applicationSession?.lock(); onAccountsChanged(); }} /> : null}
      </Stack.Screen>
      <Stack.Screen name="privacy-settings">
        {({ navigation }) => (
          <PrivacySettingsScreen settings={services.networkSettings} onBack={() => navigation.goBack()} />
        )}
      </Stack.Screen>
      <Stack.Screen name="connected-dapps">
        {({ navigation }) => (
          <ConnectedDappsScreen
            permissions={services.dappPermissions}
            networkId={services.networkProfile.id}
            accounts={accounts}
            onBack={() => navigation.goBack()}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="network-settings">
        {({ navigation }) => (
          <NetworkSettingsScreen
            monitor={services.nodeReadSession}
            settings={services.networkSettings}
            network={{
              id: services.networkProfile.id,
              horizonUrl: services.networkProfile.horizonUrl,
              isMainnet: services.networkProfile.isMainnet,
            }}
            onBack={() => navigation.goBack()}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="language-settings">
        {({ navigation }) => <LanguageSettingsScreen onBack={() => navigation.goBack()} />}
      </Stack.Screen>
      <Stack.Screen name="terms">{({ navigation }) => <TermsScreen onBack={() => navigation.goBack()} />}</Stack.Screen>
      <Stack.Screen name="support-unavailable">
        {({ navigation }) => <TermsScreen onBack={() => navigation.goBack()} supportError />}
      </Stack.Screen>
      <Stack.Screen name="about">
        {({ navigation }) => (
          <AboutScreen
            appName={APP_CONFIG.appName}
            isMainnet={services.networkProfile.isMainnet}
            projectName={APP_CONFIG.projectName}
            onBack={() => navigation.goBack()}
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

function AccountDetailsRoute(props: React.ComponentProps<typeof AccountDetailsScreen>) {
  const active = useIsFocused();
  return <AccountDetailsScreen {...props} active={active} />;
}

function AddressBookRoute(props: React.ComponentProps<typeof AddressBookScreen>) {
  const active = useIsFocused();
  return <AddressBookScreen {...props} active={active} />;
}

function requireAccount(accounts: readonly AccountRecord[], accountId: string): AccountRecord {
  const account = accounts.find(candidate => candidate.id === accountId);
  if (!account) {
    throw new Error('account-not-found');
  }
  return account;
}

// A delayed browser failure must not reopen a settings route after it loses focus.
export function openSupportWebsite(
  navigation: Readonly<{
    isFocused: () => boolean;
    addListener: (event: 'blur', callback: () => void) => () => void;
    navigate: (screen: 'support-unavailable') => void;
  }>,
) {
  let active = true;
  const unsubscribe = navigation.addListener('blur', () => {
    active = false;
  });
  Linking.openURL('https://fchain.io/')
    .catch(() => {
      if (active && navigation.isFocused()) {
        navigation.navigate('support-unavailable');
      }
    })
    .finally(unsubscribe);
}

function ThemeSettingsRoute({ onBack, selection }: Omit<React.ComponentProps<typeof ThemeSettingsScreen>, 'active'>) {
  const active = useIsFocused();
  return <ThemeSettingsScreen active={active} onBack={onBack} selection={selection} />;
}
const shareSessionLogs = async (message: string) => {
  await Share.share({ message });
};
function SessionLogsRoute(props: Omit<React.ComponentProps<typeof SessionLogsScreen>, 'share' | 'active'>) {
  const active = useIsFocused();
  return <SessionLogsScreen {...props} active={active} share={shareSessionLogs} />;
}

function GeneralSettingsRoute(props: Omit<React.ComponentProps<typeof GeneralSettingsScreen>, 'active'>) {
  const active = useIsFocused();
  return <GeneralSettingsScreen {...props} active={active} />;
}

function RecoveryMaterialRoute(props: Omit<React.ComponentProps<typeof RecoveryMaterialScreen>, 'active' | 'clipboard'>) {
  const active = useIsFocused();
  const clipboard = useMemo(() => createSensitiveClipboard(), []);
  return <RecoveryMaterialScreen {...props} active={active} clipboard={clipboard} />;
}
function ChangePassphraseRoute(props: Omit<React.ComponentProps<typeof ChangePassphraseScreen>, 'active'>) {
  const active = useIsFocused();
  return <ChangePassphraseScreen {...props} active={active} />;
}
