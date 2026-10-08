import React, {useMemo} from 'react';
import {ActivityIndicator, Text, View} from 'react-native';
import {DefaultTheme, NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import {OnboardingScreen} from '@features/onboarding/OnboardingScreen';
import {PendingMnemonicBackupScreen} from '@features/onboarding/PendingMnemonicBackupScreen';
import {RequestDeepLinkScreen} from '@features/request/RequestDeepLinkScreen';
import {useAppTheme, useThemedStyles, type AppTheme} from '@ui/theme';

import {useLocalization} from '../../locale';
import type {AppRuntimeState} from '../runtimeState';
import type {RequestDeepLinkResolved} from '../requestDeepLinkRouting';
import {createStyles} from './AppNavigator.styles';
import {MainTabsNavigator} from './MainTabsNavigator';
import {selectPersistedAccountAndDefault} from './accountSelection';
import type {RootStackParamList} from './navigationTypes';

const RootStack = createNativeStackNavigator<RootStackParamList>();

type Props = Readonly<{
  runtime: AppRuntimeState;
  onRefreshBootstrap: () => void;
  deepLink?: RequestDeepLinkResolved;
  onDismissDeepLink: () => void;
}>;

export function AppNavigator({runtime, onRefreshBootstrap, deepLink, onDismissDeepLink}: Props) {
  const appTheme = useAppTheme();
  const navigationTheme = useMemo(() => createNavigationTheme(appTheme), [appTheme]);

  return (
    <NavigationContainer theme={navigationTheme}>
      <RootStack.Navigator screenOptions={{headerShown: false}}>
        {renderRootScreen(runtime, onRefreshBootstrap, deepLink, onDismissDeepLink)}
        <RootStack.Screen name="locked" component={LockedPlaceholderScreen} />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

function createNavigationTheme(theme: AppTheme) {
  return {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary: theme.colors.actionPrimary,
      background: theme.colors.background,
      card: theme.colors.surface,
      text: theme.colors.textPrimary,
      border: theme.colors.border,
      notification: theme.colors.negative,
    },
  };
}

function renderRootScreen(
  runtime: AppRuntimeState,
  onRefreshBootstrap: () => void,
  deepLink: RequestDeepLinkResolved | undefined,
  onDismissDeepLink: () => void,
) {
  if (runtime.kind !== 'ready') {
    return (
      <RootStack.Screen name="bootstrap">
        {() => <BootstrapScreen runtime={runtime} />}
      </RootStack.Screen>
    );
  }

  const {bootstrap} = runtime;
  if (bootstrap.kind === 'ready' && deepLink !== undefined) {
    return (
      <RootStack.Screen name="request-deep-link">
        {() => <RequestDeepLinkScreen state={deepLink} onClose={onDismissDeepLink} />}
      </RootStack.Screen>
    );
  }
  if (bootstrap.kind === 'onboarding') {
    return (
      <RootStack.Screen name="onboarding">
        {() => (
          <OnboardingScreen
            dependencies={runtime.services.onboarding}
            onComplete={onRefreshBootstrap}
          />
        )}
      </RootStack.Screen>
    );
  }

  if (bootstrap.kind === 'pending-mnemonic-backup') {
    return (
      <RootStack.Screen name="onboarding">
        {() => (
          <PendingMnemonicBackupScreen
            dependencies={runtime.services.onboarding}
            securityDependencies={runtime.services.security}
            signerId={bootstrap.signerId}
            onComplete={() => {
              try {
                selectPersistedAccountAndDefault(
                  runtime.services.onboarding.repository,
                  bootstrap.accountId,
                  runtime.services.onboarding.networkId,
                  runtime.services.accountSelectionPreferences,
                );
              } catch (error) {
                runtime.services.diagnostics.warn('default-account-persistence-failed', {
                  details: {
                    networkId: runtime.services.onboarding.networkId,
                    accountId: bootstrap.accountId,
                    error,
                  },
                });
                throw new Error('default-account-persistence-failed');
              }
              onRefreshBootstrap();
            }}
          />
        )}
      </RootStack.Screen>
    );
  }

  return (
    <RootStack.Screen name="main">
      {() => (
        <MainTabsNavigator
          accounts={bootstrap.accounts}
          services={runtime.services}
          onAccountsChanged={onRefreshBootstrap}
        />
      )}
    </RootStack.Screen>
  );
}

function BootstrapScreen({runtime}: Readonly<{runtime: Exclude<AppRuntimeState, {kind: 'ready'}>}>) {
  const {t} = useLocalization();
  const theme = useAppTheme();
  const styles = useThemedStyles(createStyles);

  if (runtime.kind === 'loading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.colors.actionPrimaryPressed} />
        <Text style={styles.message}>{t('app.opening')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.centered}>
      <Text style={styles.errorTitle}>{t('app.startErrorTitle')}</Text>
      <Text style={styles.message}>{runtime.message ?? t('app.unknownStartError')}</Text>
    </View>
  );
}

function LockedPlaceholderScreen() {
  const {t} = useLocalization();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.centered}>
      <Text style={styles.errorTitle}>{t('lock.title')}</Text>
      <Text style={styles.message}>{t('lock.blocked')}</Text>
    </View>
  );
}
