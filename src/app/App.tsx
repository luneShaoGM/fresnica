import React, {useCallback, useEffect, useRef, useState} from 'react';
import {StatusBar} from 'react-native';
import {initialWindowMetrics, SafeAreaProvider} from 'react-native-safe-area-context';

import {AppThemeProvider, useAppTheme} from '@ui/theme';

import {resolveOnboardingBootstrap} from '../features/onboarding/onboardingBootstrap';
import {
  getDeviceLocale,
  LocalizationProvider,
  resolveLocale,
  type SupportedLocale,
} from '../locale';
import {createAppServices, type AppServices} from './createAppServices';
import {AppNavigator} from './navigation/AppNavigator';
import {OverlayHost} from './OverlayHost';
import type {AppRuntimeState} from './runtimeState';

export function App() {
  const [runtime, setRuntime] = useState<AppRuntimeState>({kind: 'loading'});
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
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <AppThemeProvider>
        <ThemeStatusBar />
        <LocalizationProvider locale={locale} onChangeLocale={handleChangeLocale}>
          <OverlayHost>
            <AppNavigator runtime={runtime} onRefreshBootstrap={refreshBootstrap} />
          </OverlayHost>
        </LocalizationProvider>
      </AppThemeProvider>
    </SafeAreaProvider>
  );
}

function ThemeStatusBar() {
  const theme = useAppTheme();
  return (
    <StatusBar
      animated
      barStyle={theme.statusBarContent === 'dark' ? 'dark-content' : 'light-content'}
    />
  );
}

function readableError(error: unknown): string | undefined {
  return error instanceof Error ? error.message : undefined;
}

export default App;
