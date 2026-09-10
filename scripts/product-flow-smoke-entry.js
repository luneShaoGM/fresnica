import './src/app/installRuntimePolyfills';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Realm from 'realm';
import { AppRegistry, StyleSheet, Text, View } from 'react-native';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';

import { name as appName } from './app.json';
import { loadBalanceSnapshot } from './src/capabilities/balance/loadBalanceSnapshot';
import { createAppServices } from './src/app/createAppServices';
import { AppNavigator } from './src/app/navigation/AppNavigator';
import { OverlayHost } from './src/app/OverlayHost';
import { confirmMnemonicBackup, resolveOnboardingBootstrap } from './src/features/onboarding/onboardingBootstrap';
import { runGeneratedMnemonicOnboarding } from './src/features/onboarding/runOnboardingProvisioning';
import { buildSendReview, submitSendReview } from './src/features/send/sendProductFlow';
import { LocalizationProvider } from './src/locale';
import { AppThemeProvider } from './src/ui/theme';

const FRIEND_BOT_URL = 'https://friendbot.stellar.org';
const DESTINATION = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
const TEST_APP_PASSPHRASE = 'product native flow smoke passphrase 2026';
const CALLBACK_BASE_URL = 'http://127.0.0.1:8767';
const OK_MARKER = 'FRESNICA_PRODUCT_FLOW_SMOKE_OK';
const FAIL_MARKER = 'FRESNICA_PRODUCT_FLOW_SMOKE_FAIL';
const PRODUCT_REALM_PATH = Realm.defaultPath.replace(/[^/]+$/u, 'product-flow-smoke.realm');
const styles = StyleSheet.create({
  status: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});

function delay(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function nextPaint() {
  return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

async function report(marker, payload) {
  await fetch(`${CALLBACK_BASE_URL}/${marker}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

async function fundSource(address) {
  const response = await fetch(`${FRIEND_BOT_URL}?addr=${encodeURIComponent(address)}`);
  if (!response.ok) {
    throw new Error(`friendbot-failed:${response.status}`);
  }
  await response.text();
}

async function waitForActiveBalance(services, account) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const snapshot = await loadBalanceSnapshot(services.balance, account);
    if (snapshot.status === 'active') {
      const native = snapshot.balances.find(balance => balance.asset.kind === 'native');
      if (!native) {
        throw new Error('active-account-missing-native-balance');
      }
      return { snapshot, nativeBalance: native.balance };
    }
    await delay(500);
  }
  throw new Error('friendbot-funded-account-did-not-become-active');
}

async function waitForConfirmedSubmission(services, submission) {
  if (submission.status === 'submitted') {
    return { transactionHash: submission.hash, finalStatus: 'submitted' };
  }
  if (submission.status !== 'uncertain') {
    throw new Error(`unexpected-send-result:${submission.status}`);
  }

  for (let attempt = 0; attempt < 60; attempt += 1) {
    const results = await services.transactionRecovery.reconcile('manual-refresh');
    const matched = results.find(result => result.transactionHash === submission.transactionHash);
    if (matched?.status === 'confirmed') {
      return {
        transactionHash: submission.transactionHash,
        finalStatus: 'confirmed',
      };
    }
    if (matched?.status === 'rejected') {
      throw new Error('testnet-write-reconciled-as-rejected');
    }
    await delay(1000);
  }
  throw new Error('testnet-write-did-not-confirm-within-timeout');
}

async function runProductFlow(setRuntime, onServicesReady) {
  const services = await createAppServices({ realmPath: PRODUCT_REALM_PATH });
  onServicesReady(services);

  const coldBootstrap = resolveOnboardingBootstrap(services.onboarding);
  if (coldBootstrap.kind !== 'onboarding') {
    throw new Error(`expected-cold-onboarding:${coldBootstrap.kind}`);
  }
  setRuntime({ kind: 'ready', services, bootstrap: coldBootstrap });
  await nextPaint();
  let generated = await runGeneratedMnemonicOnboarding(services.onboarding, {
    language: 'english',
    strength: 128,
    mnemonicPassphrase: '',
    index: 0,
    appPassphrase: TEST_APP_PASSPHRASE,
    label: 'Product flow smoke',
  });
  if (!generated.backup.mnemonic.trim()) {
    throw new Error('generated-backup-missing');
  }

  const account = generated.account.account;
  const signerId = generated.account.signer.id;
  const pendingBootstrap = resolveOnboardingBootstrap(services.onboarding);
  if (pendingBootstrap.kind !== 'pending-mnemonic-backup') {
    throw new Error(`expected-pending-backup:${pendingBootstrap.kind}`);
  }
  confirmMnemonicBackup(services.onboarding, signerId);
  generated = undefined;

  const readyBootstrap = resolveOnboardingBootstrap(services.onboarding);
  if (readyBootstrap.kind !== 'ready' || readyBootstrap.accounts.length !== 1) {
    throw new Error(`expected-main-shell-ready:${readyBootstrap.kind}`);
  }
  setRuntime({ kind: 'ready', services, bootstrap: readyBootstrap });
  await nextPaint();

  await fundSource(account.address);
  const before = await waitForActiveBalance(services, account);

  const review = await buildSendReview(services.send, account, {
    destination: DESTINATION,
    amount: '2.0000000',
    asset: { kind: 'native' },
  });
  const submission = await submitSendReview(services.send, account, review, TEST_APP_PASSPHRASE);
  const confirmed = await waitForConfirmedSubmission(services, submission);
  const after = await waitForActiveBalance(services, account);

  await report(OK_MARKER, {
    networkId: account.networkId,
    coldBootstrap: coldBootstrap.kind,
    pendingBackup: pendingBootstrap.kind,
    mainShell: readyBootstrap.kind,
    accountRead: before.snapshot.status,
    sourceAddress: account.address,
    beforeNativeBalance: before.nativeBalance,
    afterNativeBalance: after.nativeBalance,
    transactionHash: confirmed.transactionHash,
    writeStatus: confirmed.finalStatus,
  });
}

function ProductFlowSmokeApp() {
  const [runtime, setRuntime] = useState({ kind: 'loading' });
  const [status, setStatus] = useState('FRESNICA_PRODUCT_FLOW_SMOKE_RUNNING');
  const servicesRef = useRef();

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

  useEffect(() => {
    let mounted = true;
    runProductFlow(
      nextRuntime => {
        if (mounted) {
          setRuntime(nextRuntime);
        }
      },
      services => {
        servicesRef.current = services;
      },
    )
      .then(() => {
        if (mounted) {
          setStatus(OK_MARKER);
        }
      })
      .catch(async error => {
        const message = errorMessage(error);
        if (mounted) {
          setStatus(`${FAIL_MARKER}: ${message}`);
        }
        try {
          await report(FAIL_MARKER, { message });
        } catch (reportError) {
          console.error(FAIL_MARKER, message, errorMessage(reportError));
        }
      });
    return () => {
      mounted = false;
      servicesRef.current?.close();
      servicesRef.current = undefined;
    };
  }, []);

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <AppThemeProvider>
        <LocalizationProvider locale="en" onChangeLocale={() => undefined}>
          <OverlayHost>
            <AppNavigator runtime={runtime} onRefreshBootstrap={refreshBootstrap} />
            <View pointerEvents="none" style={styles.status}>
              <Text testID="product-flow-smoke-status">{status}</Text>
            </View>
          </OverlayHost>
        </LocalizationProvider>
      </AppThemeProvider>
    </SafeAreaProvider>
  );
}

AppRegistry.registerComponent(appName, () => ProductFlowSmokeApp);
