import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StatusBar } from 'react-native';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';

import { AppThemeProvider, useAppTheme } from '@ui/theme';

import { getDeviceLocale, LocalizationProvider, resolveLocale, type SupportedLocale } from '../locale';
import { createAppServices, type AppServices } from './createAppServices';
import { startTransactionReconciliationLifecycle } from './transaction/startTransactionReconciliationLifecycle';
import { subscribeToNetworkRecovery } from '../platform/system/networkConnectivity';
import { reactNativeRequestDeepLink } from '../platform/system/requestDeepLink';
import { AppNavigator } from './navigation/AppNavigator';
import { OverlayHost } from './OverlayHost';
import type { AppRuntimeState } from './runtimeState';
import { resolveAppBootstrap } from './resolveBootstrap';
import {
  parseRequestDeepLink,
  resolveRequestDeepLink,
  type RequestDeepLinkParsed,
  type RequestDeepLinkResolved,
} from './requestDeepLinkRouting';

export function App() {
  const [runtime, setRuntime] = useState<AppRuntimeState>({ kind: 'loading' });
  const [locale, setLocale] = useState<SupportedLocale>(() => getDeviceLocale());
  const servicesRef = useRef<AppServices | undefined>(undefined);
  const pendingRawDeepLinkRef = useRef<string | undefined>(undefined);
  const [parsedDeepLink, setParsedDeepLink] = useState<RequestDeepLinkParsed>();
  const [resolvedDeepLink, setResolvedDeepLink] = useState<RequestDeepLinkResolved>();

  const captureDeepLink = useCallback((rawUrl: string) => {
    const services = servicesRef.current;
    if (!services) {
      pendingRawDeepLinkRef.current = rawUrl;
      return;
    }
    const parsed = parseRequestDeepLink(services.request, rawUrl);
    services.diagnostics.info('request-deep-link-received', { details: parsed.diagnostics });
    setParsedDeepLink(parsed);
    setResolvedDeepLink(undefined);
  }, []);

  useEffect(() => {
    let active = true;
    let receivedWarmUrl = false;
    const unsubscribe = reactNativeRequestDeepLink.subscribe(url => {
      receivedWarmUrl = true;
      if (active) captureDeepLink(url);
    });
    reactNativeRequestDeepLink
      .getInitialUrl()
      .then(url => {
        if (active && !receivedWarmUrl && url !== undefined) captureDeepLink(url);
      })
      .catch(() => {
        servicesRef.current?.diagnostics.warn('request-deep-link-initial-read-failed');
      });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [captureDeepLink]);

  useEffect(() => {
    let mounted = true;
    let stopTransactionLifecycle: (() => void) | undefined;

    void createAppServices()
      .then(created => {
        if (!mounted) {
          created.close();
          return;
        }

        servicesRef.current = created;
        const pendingRawDeepLink = pendingRawDeepLinkRef.current;
        pendingRawDeepLinkRef.current = undefined;
        stopTransactionLifecycle = startTransactionReconciliationLifecycle({
          coordinator: created.transactionRecovery,
          currentAppState: AppState.currentState,
          subscribeAppState: listener => {
            const subscription = AppState.addEventListener('change', listener);
            return () => subscription.remove();
          },
          subscribeNetworkRecovery: listener => subscribeToNetworkRecovery(listener),
        });
        const storedLocale = created.localePreferences.getLocale();
        const resolvedLocale = resolveLocale(storedLocale ?? getDeviceLocale());
        if (!storedLocale) {
          created.localePreferences.setLocale(resolvedLocale);
        }
        setLocale(resolvedLocale);

        setRuntime({
          kind: 'ready',
          services: created,
          bootstrap: resolveAppBootstrap({
            onboarding: created.onboarding,
            accountSelectionPreferences: created.accountSelectionPreferences,
            onPreferenceFailure: (networkId, error) =>
              created.diagnostics.warn('default-account-clear-failed', {
                details: { networkId, error },
              }),
          }),
        });
        if (pendingRawDeepLink !== undefined) {
          captureDeepLink(pendingRawDeepLink);
        }
      })
      .catch(error => {
        if (mounted) {
          setRuntime({ kind: 'error', message: readableError(error) });
        }
      });

    return () => {
      mounted = false;
      stopTransactionLifecycle?.();
      servicesRef.current?.close();
      servicesRef.current = undefined;
    };
  }, [captureDeepLink]);

  useEffect(() => {
    if (parsedDeepLink === undefined || runtime.kind !== 'ready' || runtime.bootstrap.kind !== 'ready') return;
    let defaultAccountId: string | undefined;
    try {
      defaultAccountId = runtime.services.accountSelectionPreferences.getDefaultAccountId(
        runtime.services.onboarding.networkId,
      );
    } catch (error) {
      runtime.services.diagnostics.warn('default-account-read-failed', {
        details: { networkId: runtime.services.onboarding.networkId, error },
      });
    }
    setResolvedDeepLink(
      resolveRequestDeepLink(
        parsedDeepLink,
        runtime.bootstrap.accounts,
        runtime.services.onboarding.networkId,
        defaultAccountId,
        accountId => runtime.services.onboarding.repository.isWatchOnly(accountId),
      ),
    );
  }, [parsedDeepLink, runtime]);

  const refreshBootstrap = useCallback(() => {
    setRuntime(current => {
      if (current.kind !== 'ready') {
        return current;
      }

      return {
        ...current,
        bootstrap: resolveAppBootstrap({
          onboarding: current.services.onboarding,
          accountSelectionPreferences: current.services.accountSelectionPreferences,
          onPreferenceFailure: (networkId, error) =>
            current.services.diagnostics.warn('default-account-clear-failed', {
              details: { networkId, error },
            }),
        }),
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
            <AppNavigator
              runtime={runtime}
              onRefreshBootstrap={refreshBootstrap}
              deepLink={resolvedDeepLink}
              onDismissDeepLink={() => {
                setParsedDeepLink(undefined);
                setResolvedDeepLink(undefined);
              }}
            />
          </OverlayHost>
        </LocalizationProvider>
      </AppThemeProvider>
    </SafeAreaProvider>
  );
}

function ThemeStatusBar() {
  const theme = useAppTheme();
  return <StatusBar animated barStyle={theme.statusBarContent === 'dark' ? 'dark-content' : 'light-content'} />;
}

function readableError(error: unknown): string | undefined {
  return error instanceof Error ? error.message : undefined;
}

export default App;
