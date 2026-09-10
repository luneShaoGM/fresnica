import './src/app/installRuntimePolyfills';

import React, {useEffect, useState} from 'react';
import Realm from 'realm';
import {AppRegistry, NativeModules, Text, View} from 'react-native';

import {name as appName} from './app.json';
import {reconcilePendingSubmissions} from './src/capabilities/transaction/reconcilePendingSubmissions';
import {buildSendReview, submitSendReview} from './src/features/send/sendProductFlow';
import {
  ReactNativeFresnicaSdk,
  loadNativeFresnicaModule,
} from './src/platform/fresnica/native';
import {InMemoryAccountSignerRepository} from './src/platform/persistence/memory/InMemoryAccountSignerRepository';
import {RealmPendingSubmissionRepository} from './src/platform/persistence/realm/RealmPendingSubmissionRepository';
import {openWalletRealm} from './src/platform/persistence/realm/openWalletRealm';
import {StellarSdkGateway} from './src/platform/stellar/StellarSdkGateway';

const NETWORK = Object.freeze({
  id: 'stellar-testnet',
  networkPassphrase: 'Test SDF Network ; September 2015',
});
const HORIZON_URL = 'https://horizon-testnet.stellar.org';
const FRIEND_BOT_URL = 'https://friendbot.stellar.org';
const DESTINATION = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
const TEST_APP_PASSPHRASE = 'transaction-recovery-smoke recovery test passphrase 2026';
const CALLBACK_BASE_URL = 'http://127.0.0.1:8766';
const PENDING_MARKER = 'FRESNICA_TRANSACTION_RECOVERY_PENDING';
const RECOVERED_MARKER = 'FRESNICA_TRANSACTION_RECOVERY_RECOVERED';
const FAIL_MARKER = 'FRESNICA_TRANSACTION_RECOVERY_FAIL';
const RECOVERY_REALM_PATH = Realm.defaultPath.replace(
  /[^/]+$/,
  'transaction-recovery-smoke.realm',
);

const noOpReadInvalidation = Object.freeze({invalidate() {}});

function delay(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function report(marker, payload) {
  await fetch(`${CALLBACK_BASE_URL}/${marker}`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(payload),
  });
}
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

async function waitForActiveAccount(gateway, address) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    let state;
    try {
      state = await gateway.loadAccountState(address);
    } catch (error) {
      throw new Error(`horizon-account-network:${errorMessage(error)}`);
    }
    if (state.status === 'active') {
      return;
    }
    await delay(500);
  }
  throw new Error('friendbot-funded-account-did-not-become-active');
}

async function fundSource(address) {
  let response;
  try {
    response = await fetch(`${FRIEND_BOT_URL}?addr=${encodeURIComponent(address)}`);
  } catch (error) {
    throw new Error(`friendbot-network:${errorMessage(error)}`);
  }
  if (!response.ok) {
    throw new Error(`friendbot-failed:${response.status}`);
  }
  await response.text();
}

function forceUncertainAfterAccepted(realGateway) {
  return new Proxy(realGateway, {
    get(target, property) {
      if (property === 'submitTransaction') {
        return async signedXdrBase64 => {
          const result = await target.submitTransaction(signedXdrBase64);
          if (result.status !== 'accepted') {
            throw new Error(
              `expected-production-testnet-acceptance:${result.status}:${result.resultCode ?? 'no-result-code'}`,
            );
          }
          return {status: 'uncertain', transactionHash: result.hash};
        };
      }
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

async function createPendingSubmission(sdk, pendingRepository) {
  let generated = await sdk.generateMnemonic({
    language: 'english',
    strength: 128,
    mnemonicPassphrase: '',
    index: 0,
    appPassphrase: TEST_APP_PASSPHRASE,
  });
  const protectedSigner = generated.signer;
  generated = undefined;
  const now = new Date();
  const account = {
    id: 'transaction-recovery-source-account',
    address: protectedSigner.signerPublicKey,
    identityKind: 'classic',
    networkId: NETWORK.id,
    label: 'Transaction recovery smoke source',
    sortOrder: 0,
    hidden: false,
    createdAt: now,
    updatedAt: now,
  };
  const signer = {
    id: 'transaction-recovery-source-signer',
    publicKey: protectedSigner.signerPublicKey,
    kind: 'protected-software',
    envelopeJson: protectedSigner.envelopeJson,
    recoveryKind: 'mnemonic',
    createdAt: now,
    updatedAt: now,
  };
  const accountRepository = new InMemoryAccountSignerRepository();
  accountRepository.createAccountWithSigner({account, signer, attachedAt: now});

  const realGateway = new StellarSdkGateway({network: NETWORK, horizonUrl: HORIZON_URL});
  await fundSource(account.address);
  await waitForActiveAccount(realGateway, account.address);
  const gateway = forceUncertainAfterAccepted(realGateway);
  const recovery = {
    repository: pendingRepository,
    readInvalidation: noOpReadInvalidation,
    now: () => new Date(),
  };
  const dependencies = {
    gateway,
    sdk,
    repository: accountRepository,
    recovery,
    network: NETWORK,
  };

  let review;
  try {
    review = await buildSendReview(dependencies, account, {
    destination: DESTINATION,
    amount: '2.0000000',
      asset: {kind: 'native'},
    });
  } catch (error) {
    throw new Error(`prepare-payment:${errorMessage(error)}`);
  }
  let result;
  try {
    result = await submitSendReview(
    dependencies,
    account,
    review,
      TEST_APP_PASSPHRASE,
    );
  } catch (error) {
    throw new Error(`submit-payment:${errorMessage(error)}`);
  }

  if (result.status !== 'uncertain') {
    throw new Error(`expected-uncertain-result:${result.status}`);
  }
  const pending = pendingRepository.get(NETWORK.id, result.transactionHash);
  if (!pending || pending.state !== 'uncertain') {
    throw new Error('uncertain-result-not-persisted');
  }

  await report(PENDING_MARKER, {
    networkId: pending.networkId,
    accountId: pending.accountId,
    sourceAddress: pending.sourceAddress,
    transactionHash: pending.transactionHash,
    intentKind: pending.intentKind,
    state: pending.state,
    realmPath: RECOVERY_REALM_PATH,
  });

  // Keep this process and Realm open. The external runner force-stops the app
  // after receiving PENDING_MARKER to prove restart recovery from durable data.
  await new Promise(() => {});
}

async function recoverPendingSubmission(pendingRepository) {
  const pending = pendingRepository.listUnresolved(NETWORK.id);
  if (pending.length !== 1) {
    throw new Error(`expected-one-pending-record:${pending.length}`);
  }
  const record = pending[0];
  const gateway = new StellarSdkGateway({network: NETWORK, horizonUrl: HORIZON_URL});
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const results = await reconcilePendingSubmissions({
      gateway,
      repository: pendingRepository,
      readInvalidation: noOpReadInvalidation,
      networkId: NETWORK.id,
      now: () => new Date(),
    });
    const result = results.find(item => item.transactionHash === record.transactionHash);
    if (result?.status === 'confirmed') {
      const blocking = pendingRepository.findBlockingIntent(
        record.networkId,
        record.accountId,
        record.intentKey,
      );
      if (blocking) {
        throw new Error('confirmed-transaction-still-blocking');
      }
      await report(RECOVERED_MARKER, {
        networkId: record.networkId,
        accountId: record.accountId,
        sourceAddress: record.sourceAddress,
        transactionHash: record.transactionHash,
        state: 'confirmed',
        realmPath: RECOVERY_REALM_PATH,
      });
      return;
    }
    if (result?.status === 'rejected') {
      throw new Error('real-testnet-transaction-reconciled-as-rejected');
    }
    await delay(1000);
  }
  throw new Error('pending-transaction-did-not-reconcile-within-timeout');
}

async function runStage25Recovery() {
  const realm = await openWalletRealm({path: RECOVERY_REALM_PATH});
  const pendingRepository = new RealmPendingSubmissionRepository(realm);
  const unresolved = pendingRepository.listUnresolved(NETWORK.id);

  if (unresolved.length > 0) {
    try {
      await recoverPendingSubmission(pendingRepository);
    } finally {
      realm.close();
    }
    return;
  }

  const sdk = new ReactNativeFresnicaSdk(loadNativeFresnicaModule(NativeModules));
  try {
    await createPendingSubmission(sdk, pendingRepository);
  } catch (error) {
    realm.close();
    throw error;
  }
}
function Stage25RecoveryApp() {
  const [status, setStatus] = useState('FRESNICA_TRANSACTION_RECOVERY_RUNNING');

  useEffect(() => {
    runStage25Recovery()
      .then(() => setStatus(RECOVERED_MARKER))
      .catch(async error => {
        const message = errorMessage(error);
        setStatus(`${FAIL_MARKER}: ${message}`);
        try {
          await report(FAIL_MARKER, {message});
        } catch (reportError) {
          console.error(FAIL_MARKER, message, errorMessage(reportError));
        }
      });
  }, []);

  return React.createElement(
    View,
    {testID: 'transaction-recovery-smoke-testnet-recovery-smoke'},
    React.createElement(Text, null, status),
  );
}

AppRegistry.registerComponent(appName, () => Stage25RecoveryApp);
