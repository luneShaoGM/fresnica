import React from 'react';
import {ActivityIndicator, Text, View} from 'react-native';
import {DefaultTheme, NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import {OnboardingScreen} from '@features/onboarding/OnboardingScreen';
import {PendingMnemonicBackupScreen} from '@features/onboarding/PendingMnemonicBackupScreen';
import {defaultTheme, useAppTheme, useThemedStyles} from '@ui/theme';

import {useLocalization} from '../../locale';
import type {AppRuntimeState} from '../runtimeState';
import {createStyles} from './AppNavigator.styles';
import {MainTabsNavigator} from './MainTabsNavigator';
import type {RootStackParamList} from './navigationTypes';

const RootStack = createNativeStackNavigator<RootStackParamList>();

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: defaultTheme.colors.actionPrimary,
    background: defaultTheme.colors.background,
    card: defaultTheme.colors.surface,
    text: defaultTheme.colors.textPrimary,
    border: defaultTheme.colors.border,
    notification: defaultTheme.colors.negative,
  },
};

type Props = Readonly<{
  runtime: AppRuntimeState;
  onRefreshBootstrap: () => void;
}>;

export function AppNavigator({runtime, onRefreshBootstrap}: Props) {
  return (
    <NavigationContainer theme={navigationTheme}>
      <RootStack.Navigator screenOptions={{headerShown: false}}>
        {renderRootScreen(runtime, onRefreshBootstrap)}
        <RootStack.Screen name="locked" component={LockedPlaceholderScreen} />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

function renderRootScreen(runtime: AppRuntimeState, onRefreshBootstrap: () => void) {
  if (runtime.kind !== 'ready') {
    return (
      <RootStack.Screen name="bootstrap">
        {() => <BootstrapScreen runtime={runtime} />}
      </RootStack.Screen>
    );
  }

  const {bootstrap} = runtime;
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
            signerId={bootstrap.signerId}
            onComplete={onRefreshBootstrap}
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
