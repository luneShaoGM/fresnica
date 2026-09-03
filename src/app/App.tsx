import React, {useCallback, useEffect, useRef, useState} from 'react';
import {ActivityIndicator, StyleSheet, Text, View} from 'react-native';

import {OnboardingScreen} from '../features/onboarding/OnboardingScreen';
import {PendingMnemonicBackupScreen} from '../features/onboarding/PendingMnemonicBackupScreen';
import {
  resolveOnboardingBootstrap,
  type OnboardingBootstrapState,
} from '../features/onboarding/onboardingBootstrap';
import {
  getDeviceLocale,
  LocalizationProvider,
  resolveLocale,
  useLocalization,
  type SupportedLocale,
} from '../locale';
import {createAppServices, type AppServices} from './createAppServices';
import {ProductRuntime} from './navigation/ProductRuntime';

type RuntimeState =
  | Readonly<{kind: 'loading'}>
  | Readonly<{kind: 'error'; message?: string}>
  | Readonly<{
      kind: 'ready';
      services: AppServices;
      bootstrap: OnboardingBootstrapState;
    }>;

export function App() {
  const [runtime, setRuntime] = useState<RuntimeState>({kind: 'loading'});
  const [locale, setLocale] = useState<SupportedLocale>(() => getDeviceLocale());
  const servicesRef = useRef<AppServices | undefined>(undefined);

  useEffect(() => {
    let mounted = true;

    void createAppServices()
      .then(created => {
        if (!mounted) {
          created.close();
          return;
        }

        servicesRef.current = created;
        const storedLocale = created.localePreferences.getLocale();
        const resolvedLocale = resolveLocale(storedLocale ?? getDeviceLocale());
        if (!storedLocale) {
          created.localePreferences.setLocale(resolvedLocale);
        }
        setLocale(resolvedLocale);

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
      servicesRef.current?.close();
      servicesRef.current = undefined;
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

  const handleChangeLocale = useCallback((nextLocale: SupportedLocale) => {
    servicesRef.current?.localePreferences.setLocale(nextLocale);
    setLocale(nextLocale);
  }, []);

  return (
    <LocalizationProvider locale={locale} onChangeLocale={handleChangeLocale}>
      <AppContent runtime={runtime} onRefreshBootstrap={refreshBootstrap} />
    </LocalizationProvider>
  );
}

function AppContent({
  runtime,
  onRefreshBootstrap,
}: Readonly<{
  runtime: RuntimeState;
  onRefreshBootstrap: () => void;
}>) {
  const {t} = useLocalization();

  if (runtime.kind === 'loading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
        <Text>{t('app.opening')}</Text>
      </View>
    );
  }

  if (runtime.kind === 'error') {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>{t('app.startErrorTitle')}</Text>
        <Text>{runtime.message ?? t('app.unknownStartError')}</Text>
      </View>
    );
  }

  if (runtime.bootstrap.kind === 'onboarding') {
    return (
      <OnboardingScreen
        dependencies={runtime.services.onboarding}
        onComplete={onRefreshBootstrap}
      />
    );
  }

  if (runtime.bootstrap.kind === 'pending-mnemonic-backup') {
    return (
      <PendingMnemonicBackupScreen
        dependencies={runtime.services.onboarding}
        signerId={runtime.bootstrap.signerId}
        onComplete={onRefreshBootstrap}
      />
    );
  }

  return (
    <ProductRuntime
      accounts={runtime.bootstrap.accounts}
      services={runtime.services}
      onAccountsChanged={onRefreshBootstrap}
    />
  );
}

function readableError(error: unknown): string | undefined {
  return error instanceof Error ? error.message : undefined;
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
