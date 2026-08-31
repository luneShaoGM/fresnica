import React, {useCallback, useEffect, useState} from 'react';
import {ActivityIndicator, StyleSheet, Text, View} from 'react-native';

import {OnboardingScreen} from '../features/onboarding/OnboardingScreen';
import {PendingMnemonicBackupScreen} from '../features/onboarding/PendingMnemonicBackupScreen';
import {
  resolveOnboardingBootstrap,
  type OnboardingBootstrapState,
} from '../features/onboarding/onboardingBootstrap';
import {createAppServices, type AppServices} from './createAppServices';
import {ProductRuntime} from './navigation/ProductRuntime';

type RuntimeState =
  | Readonly<{kind: 'loading'}>
  | Readonly<{kind: 'error'; message: string}>
  | Readonly<{
      kind: 'ready';
      services: AppServices;
      bootstrap: OnboardingBootstrapState;
    }>;

export function App() {
  const [runtime, setRuntime] = useState<RuntimeState>({kind: 'loading'});

  useEffect(() => {
    let mounted = true;
    let services: AppServices | undefined;

    void createAppServices()
      .then(created => {
        services = created;
        if (!mounted) {
          created.close();
          return;
        }

        setRuntime({
          kind: 'ready',
          services: created,
          bootstrap: resolveOnboardingBootstrap(created.onboarding),
        });
      })
      .catch(error => {
        if (mounted) {
          setRuntime({kind: 'error', message: readableError(error)});
        }
      });

    return () => {
      mounted = false;
      services?.close();
    };
  }, []);

  const refreshBootstrap = useCallback(() => {
    setRuntime(current => {
      if (current.kind !== 'ready') {
        return current;
      }

      return {
        ...current,
        bootstrap: resolveOnboardingBootstrap(current.services.onboarding),
      };
    });
  }, []);

  if (runtime.kind === 'loading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
        <Text>Opening Fresnica...</Text>
      </View>
    );
  }

  if (runtime.kind === 'error') {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Fresnica could not start</Text>
        <Text>{runtime.message}</Text>
      </View>
    );
  }

  if (runtime.bootstrap.kind === 'onboarding') {
    return (
      <OnboardingScreen
        dependencies={runtime.services.onboarding}
        onComplete={refreshBootstrap}
      />
    );
  }

  if (runtime.bootstrap.kind === 'pending-mnemonic-backup') {
    return (
      <PendingMnemonicBackupScreen
        dependencies={runtime.services.onboarding}
        signerId={runtime.bootstrap.signerId}
        onComplete={refreshBootstrap}
      />
    );
  }

  return (
    <ProductRuntime
      accounts={runtime.bootstrap.accounts}
      services={runtime.services}
      onAccountsChanged={refreshBootstrap}
    />
  );
}

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown startup error.';
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
});

export default App;
