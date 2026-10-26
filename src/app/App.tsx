import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState, StatusBar } from 'react-native';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';

import { AppThemeProvider, useAppTheme } from '@ui/theme';

import { getDeviceLocale, LocalizationProvider, resolveLocale, type SupportedLocale } from '../locale';
import { createAppServices, type AppServices } from './createAppServices';
import { startRequestDeepLinkIntake } from './readModels/startRequestDeepLinkIntake';
import type { LedgerReadRuntimeSnapshot } from './readModels/LedgerReadRuntime';
import { startLedgerReadLifecycle } from './readModels/startLedgerReadLifecycle';
import { subscribeToInternetConnectivity } from '../platform/system/networkConnectivity';
import { reactNativeRequestDeepLink } from '../platform/system/requestDeepLink';
import { AppNavigator } from './navigation/AppNavigator';
import { OverlayHost } from './OverlayHost';
import { UiNativeProvider } from './UiNativeProvider';
import type { AppRuntimeState } from './runtimeState';
import { resolveAppBootstrap } from './resolveBootstrap';
import {
  parseRequestDeepLink,
  resolveRequestDeepLink,
  type RequestDeepLinkParsed,
  type RequestDeepLinkResolved,
} from './requestDeepLinkRouting';

const inactiveReads: LedgerReadRuntimeSnapshot = { foreground: false, connectivity: 'unknown' };
const noSubscription = () => () => {};
const inactiveSnapshot = () => inactiveReads;

export function App() {
  const [runtime, setRuntime] = useState<AppRuntimeState>({ kind: 'loading' });
  const [locale, setLocale] = useState<SupportedLocale>(() => getDeviceLocale());
  const servicesRef = useRef<AppServices | undefined>(undefined);
  const intake = useRef<ReturnType<typeof startRequestDeepLinkIntake> | undefined>(undefined);
  const linkGeneration = useRef(0);
  const resolvedFor = useRef<Readonly<{ parsed: RequestDeepLinkParsed; runtime: AppRuntimeState }> | undefined>(
    undefined,
  );
  const readRuntime = useSyncExternalStore(
    runtime.kind === 'ready' ? runtime.services.ledgerReadRuntime.subscribe : noSubscription,
    runtime.kind === 'ready' ? runtime.services.ledgerReadRuntime.getSnapshot : inactiveSnapshot,
    inactiveSnapshot,
  );
  const [parsedDeepLink, setParsedDeepLink] = useState<RequestDeepLinkParsed>();
  const [resolvedDeepLink, setResolvedDeepLink] = useState<RequestDeepLinkResolved>();

  const captureDeepLink = useCallback((rawUrl: string) => {
    const services = servicesRef.current;
    if (!services) return;
    linkGeneration.current += 1;
    const parsed = parseRequestDeepLink(services.request, rawUrl);
    services.diagnostics.info('request-deep-link-received', { details: parsed.diagnostics });
    setParsedDeepLink(parsed);
    setResolvedDeepLink(undefined);
  }, []);

  useEffect(() => {
    const owner = startRequestDeepLinkIntake({
      port: reactNativeRequestDeepLink,
      onCapture: captureDeepLink,
      onFailure: () => servicesRef.current?.diagnostics.warn('request-deep-link-initial-read-failed'),
    });
    intake.current = owner;
    return () => {
      owner.close();
      if (intake.current === owner) intake.current = undefined;
    };
  }, [captureDeepLink]);

  useEffect(() => {
    intake.current?.setReady(runtime.kind === 'ready' && runtime.bootstrap.kind === 'ready' && readRuntime.foreground);
    return () => intake.current?.setReady(false);
  }, [runtime, readRuntime.foreground]);

  useEffect(() => {
    let mounted = true;
    let stopLedgerReadLifecycle: (() => void) | undefined;

    void createAppServices()
      .then(created => {
        if (!mounted) {
          created.close();
          return;
        }

        servicesRef.current = created;
        stopLedgerReadLifecycle = startLedgerReadLifecycle({
          runtime: created.ledgerReadRuntime,
          node: created.nodeReadSession,
          invalidation: created.ledgerReadInvalidation,
          coordinator: created.transactionRecovery,
          networkId: created.onboarding.networkId,
          getAccounts: () => created.onboarding.repository.listAccounts(),
          onFailure: error => created.diagnostics.warn('ledger-read-lifecycle-recovery-failed', { details: { error } }),
          currentAppState: AppState.currentState,
          subscribeAppState: listener => {
            const subscription = AppState.addEventListener('change', listener);
            return () => subscription.remove();
          },
          subscribeConnectivity: listener => subscribeToInternetConnectivity(listener),
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
      })
      .catch(error => {
        if (mounted) {
          setRuntime({ kind: 'error', message: readableError(error) });
        }
      });

    return () => {
      mounted = false;
      stopLedgerReadLifecycle?.();
      servicesRef.current?.close();
      servicesRef.current = undefined;
    };
  }, [captureDeepLink]);

  useEffect(() => {
    if (
      parsedDeepLink === undefined ||
      runtime.kind !== 'ready' ||
      runtime.bootstrap.kind !== 'ready' ||
      !readRuntime.foreground ||
      readRuntime.connectivity === 'offline' ||
      (resolvedFor.current?.parsed === parsedDeepLink && resolvedFor.current.runtime === runtime)
    )
      return;
    let active = true;
    const generation = linkGeneration.current;
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
    resolveRequestDeepLink(
      runtime.services.send,
      parsedDeepLink,
      runtime.bootstrap.accounts,
      defaultAccountId,
      accountId => runtime.services.onboarding.repository.isWatchOnly(accountId),
    )
      .then(resolved => {
        if (
          active &&
          generation === linkGeneration.current &&
          readRuntime === runtime.services.ledgerReadRuntime.getSnapshot()
        ) {
          resolvedFor.current = { parsed: parsedDeepLink, runtime };
          setResolvedDeepLink(resolved);
        }
      })
      .catch(error => {
        runtime.services.diagnostics.warn('request-deep-link-resolution-failed', {
          details: { category: parsedDeepLink.diagnostics.category, error },
        });
        if (
          active &&
          generation === linkGeneration.current &&
          readRuntime === runtime.services.ledgerReadRuntime.getSnapshot()
        ) {
          resolvedFor.current = { parsed: parsedDeepLink, runtime };
          setResolvedDeepLink({ kind: 'blocked', reason: 'account-ineligible' });
        }
      });
    return () => {
      active = false;
    };
  }, [parsedDeepLink, runtime, readRuntime]);

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
        <UiNativeProvider locale={locale}>
          <ThemeStatusBar />
          <LocalizationProvider locale={locale} onChangeLocale={handleChangeLocale}>
            <OverlayHost>
              <AppNavigator
                runtime={runtime}
                onRefreshBootstrap={refreshBootstrap}
                deepLink={resolvedDeepLink}
                onDismissDeepLink={() => {
                  linkGeneration.current += 1;
                  intake.current?.dismiss();
                  resolvedFor.current = undefined;
                  setParsedDeepLink(undefined);
                  setResolvedDeepLink(undefined);
                }}
              />
            </OverlayHost>
          </LocalizationProvider>
        </UiNativeProvider>
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
