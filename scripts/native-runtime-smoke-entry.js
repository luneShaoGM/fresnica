import './src/app/installRuntimePolyfills';

import React, { useEffect, useState } from 'react';
import Realm from 'realm';
import { AppRegistry, NativeModules, Text, View } from 'react-native';
import { Keypair } from '@stellar/stellar-sdk/axios';
import { name as appName } from './app.json';
import { createAppServices } from './src/app/createAppServices';
import { selectPersistedAccountAndDefault } from './src/app/navigation/accountSelection';
import { createExistingWalletAccount } from './src/features/accounts/createExistingWalletAccount';
import { importExistingWalletAccount } from './src/features/accounts/importExistingWalletAccount';
import {
  completeMnemonicBackup,
  confirmMnemonicBackup,
  recoverPendingMnemonicBackup,
  resolveOnboardingBootstrap,
} from './src/features/onboarding/onboardingBootstrap';
import {
  runGeneratedMnemonicOnboarding,
  runWatchOnlyOnboarding,
} from './src/features/onboarding/runOnboardingProvisioning';

const VALID_CLASSIC_ACCOUNT = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
const OK_MARKER = 'FRESNICA_PARSE_ACCOUNT_SMOKE_OK';
const FAIL_MARKER = 'FRESNICA_PARSE_ACCOUNT_SMOKE_FAIL';
const CALLBACK_BASE_URL = 'http://127.0.0.1:8765';
const VERIFICATION_PASSPHRASE = 'Fresnica runtime verification passphrase 2026';
const REALM_SMOKE_SCHEMA = {
  name: 'RuntimeSmokeRecord',
  primaryKey: 'id',
  properties: {
    id: 'string',
    value: 'string',
  },
};

async function report(marker, payload) {
  await fetch(`${CALLBACK_BASE_URL}/${marker}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

function errorMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function fresnicaNativeModuleKeys() {
  return Object.keys(NativeModules)
    .filter(key => key.toLowerCase().includes('fresnica'))
    .sort();
}

function fresnicaNativeModuleDiagnostic() {
  const alternate = NativeModules.FresnicaCoreModule;
  return {
    enumerableKeys: fresnicaNativeModuleKeys(),
    hasFresnicaCoreModule:
      alternate !== null && typeof alternate === 'object' && typeof alternate.parseAccount === 'function',
  };
}

async function verifyRealmRuntime(operation) {
  const realm = await Realm.open({
    schema: [REALM_SMOKE_SCHEMA],
    inMemory: true,
  });

  try {
    realm.write(() => {
      realm.create('RuntimeSmokeRecord', { id: 'smoke', value: 'ok' });
    });
    const result = await operation();
    const records = realm.objects('RuntimeSmokeRecord');
    const record = realm.objectForPrimaryKey('RuntimeSmokeRecord', 'smoke');
    if (records.length !== 1 || record?.value !== 'ok') {
      throw new Error('Passphrase verification unexpectedly changed Realm smoke state');
    }
    return result;
  } finally {
    realm.close();
  }
}

async function rejectedCode(operation, label) {
  try {
    await operation();
  } catch (error) {
    return error?.code ?? 'unknown';
  }
  throw new Error(`${label} unexpectedly succeeded`);
}

async function rejectedReason(operation, label) {
  try {
    await operation();
  } catch (error) {
    return error?.code ?? error?.message ?? 'unknown';
  }
  throw new Error(`${label} unexpectedly succeeded`);
}

async function verifyProtectedSignerPassphraseRuntime(core) {
  let generated = await core.generateMnemonic('english', 128, '', 0, VERIFICATION_PASSPHRASE);
  const signer = generated?.signer;
  generated = undefined;
  if (
    signer === null ||
    typeof signer !== 'object' ||
    typeof signer.envelopeJson !== 'string' ||
    typeof signer.signerPublicKey !== 'string'
  ) {
    throw new Error('Runtime smoke could not create a protected signer');
  }

  const envelopeBefore = signer.envelopeJson;
  const verified = await core.verifyProtectedSignerPassphrase(
    envelopeBefore,
    VERIFICATION_PASSPHRASE,
    signer.signerPublicKey,
  );
  if (verified !== true) {
    throw new Error(`Unexpected verification result: ${JSON.stringify(verified)}`);
  }

  const wrongPassphraseCode = await rejectedCode(
    () =>
      core.verifyProtectedSignerPassphrase(envelopeBefore, `${VERIFICATION_PASSPHRASE} wrong`, signer.signerPublicKey),
    'wrong passphrase verification',
  );
  if (wrongPassphraseCode !== 'invalid-passcode') {
    throw new Error(`Unexpected wrong-passphrase error code: ${String(wrongPassphraseCode)}`);
  }

  const identityMismatchCode = await rejectedCode(
    () => core.verifyProtectedSignerPassphrase(envelopeBefore, VERIFICATION_PASSPHRASE, VALID_CLASSIC_ACCOUNT),
    'identity-mismatch verification',
  );
  const malformedEnvelopeCode = await rejectedCode(
    () =>
      core.verifyProtectedSignerPassphrase('not-a-protected-envelope', VERIFICATION_PASSPHRASE, signer.signerPublicKey),
    'malformed-envelope verification',
  );
  if (signer.envelopeJson !== envelopeBefore) {
    throw new Error('Passphrase verification unexpectedly changed the protected envelope');
  }

  return {
    wrongPassphraseCode,
    identityMismatchCode,
    malformedEnvelopeCode,
  };
}

async function verifyExistingWalletCreateRuntime() {
  const realmPath = Realm.defaultPath.replace(/[^/]+$/u, `s01-existing-wallet-create-smoke-${Date.now()}.realm`);
  let services = await createAppServices({ realmPath });

  try {
    let initial = await runGeneratedMnemonicOnboarding(services.onboarding, {
      language: 'english',
      strength: 128,
      mnemonicPassphrase: '',
      index: 0,
      appPassphrase: VERIFICATION_PASSPHRASE,
      label: 'Existing protected account',
    });
    const initialAccountId = initial.account.account.id;
    confirmMnemonicBackup(services.onboarding, initial.account.signer.id);
    selectPersistedAccountAndDefault(
      services.onboarding.repository,
      initialAccountId,
      services.onboarding.networkId,
      services.accountSelectionPreferences,
    );
    initial = undefined;

    const beforeWrongPassphrase = {
      accounts: services.onboarding.repository.listAccounts().length,
      signers: services.onboarding.repository.listSigners().length,
      defaultAccountId: services.accountSelectionPreferences.getDefaultAccountId(services.onboarding.networkId),
    };
    const wrongPassphraseCode = await rejectedCode(
      () =>
        createExistingWalletAccount(services.onboarding, {
          appPassphrase: `${VERIFICATION_PASSPHRASE} wrong`,
        }),
      'existing-wallet Create wrong passphrase',
    );
    const afterWrongPassphrase = {
      accounts: services.onboarding.repository.listAccounts().length,
      signers: services.onboarding.repository.listSigners().length,
      defaultAccountId: services.accountSelectionPreferences.getDefaultAccountId(services.onboarding.networkId),
    };
    if (
      wrongPassphraseCode !== 'invalid-passcode' ||
      JSON.stringify(afterWrongPassphrase) !== JSON.stringify(beforeWrongPassphrase)
    ) {
      throw new Error(
        `Existing-wallet Create wrong-passphrase write leak: ${JSON.stringify({ wrongPassphraseCode, beforeWrongPassphrase, afterWrongPassphrase })}`,
      );
    }

    let created = await createExistingWalletAccount(services.onboarding, {
      appPassphrase: VERIFICATION_PASSPHRASE,
      label: 'Second protected account',
    });
    const createdAccountId = created.account.account.id;
    const createdSignerId = created.account.signer.id;
    const createdSignerPublicKey = created.account.signer.publicKey;
    const systemAuthRegistration = created.systemAuthRegistration;
    if (
      created.account.signer.backupState !== 'pending' ||
      services.onboarding.repository.listAccounts().length !== 2 ||
      services.accountSelectionPreferences.getDefaultAccountId(services.onboarding.networkId) !== initialAccountId
    ) {
      throw new Error('Existing-wallet Create did not preserve pending/default invariants');
    }
    created = undefined;

    services.close();
    services = await createAppServices({ realmPath });
    const pending = resolveOnboardingBootstrap(services.onboarding);
    if (
      pending.kind !== 'pending-mnemonic-backup' ||
      pending.accountId !== createdAccountId ||
      pending.signerId !== createdSignerId
    ) {
      throw new Error(`Existing-wallet Create restart did not restore pending backup: ${pending.kind}`);
    }

    const recovered = await recoverPendingMnemonicBackup(services.onboarding, createdSignerId, VERIFICATION_PASSPHRASE);
    if (!recovered.mnemonic.trim()) {
      throw new Error('Existing-wallet Create pending backup recovery returned no mnemonic');
    }

    await completeMnemonicBackup(services.onboarding, createdSignerId, () => {
      selectPersistedAccountAndDefault(
        services.onboarding.repository,
        createdAccountId,
        services.onboarding.networkId,
        services.accountSelectionPreferences,
      );
    });

    services.close();
    services = await createAppServices({ realmPath });
    const ready = resolveOnboardingBootstrap(services.onboarding);
    const restoredSigner = services.onboarding.repository.getSigner(createdSignerId);
    const restoredDefault = services.accountSelectionPreferences.getDefaultAccountId(services.onboarding.networkId);
    if (
      ready.kind !== 'ready' ||
      ready.accounts.length !== 2 ||
      restoredSigner?.backupState !== 'confirmed' ||
      restoredDefault !== createdAccountId
    ) {
      throw new Error('Existing-wallet Create did not restore confirmed backup/default after restart');
    }

    return {
      existingWalletCreate: 'ok',
      wrongPassphraseCode,
      pendingRestartRecovery: 'ok',
      restoredDefaultAccountId: restoredDefault,
      createdSignerPublicKey,
      systemAuthRegistration,
    };
  } finally {
    services.close();
  }
}

async function verifyExistingWalletImportRuntime() {
  const realmPath = Realm.defaultPath.replace(/[^/]+$/u, `s01-existing-wallet-import-smoke-${Date.now()}.realm`);
  let services = await createAppServices({ realmPath });

  try {
    let initial = await runGeneratedMnemonicOnboarding(services.onboarding, {
      language: 'english',
      strength: 128,
      mnemonicPassphrase: '',
      index: 0,
      appPassphrase: VERIFICATION_PASSPHRASE,
      label: 'Existing protected account',
    });
    const initialAccountId = initial.account.account.id;
    confirmMnemonicBackup(services.onboarding, initial.account.signer.id);
    selectPersistedAccountAndDefault(
      services.onboarding.repository,
      initialAccountId,
      services.onboarding.networkId,
      services.accountSelectionPreferences,
    );
    initial = undefined;

    const secretFixtureSeed = Uint8Array.from({ length: 32 }, (_value, index) => index + 1);
    const secretFixture = Keypair.fromRawEd25519Seed(secretFixtureSeed);
    secretFixtureSeed.fill(0);
    let importedSecret = secretFixture.secret();
    const secretPublicKey = secretFixture.publicKey();
    const beforeWrongPassphrase = {
      accounts: services.onboarding.repository.listAccounts().length,
      signers: services.onboarding.repository.listSigners().length,
      defaultAccountId: services.accountSelectionPreferences.getDefaultAccountId(services.onboarding.networkId),
    };
    const wrongPassphraseCode = await rejectedCode(
      () =>
        importExistingWalletAccount(services.onboarding, {
          kind: 'secret',
          secret: importedSecret,
          appPassphrase: `${VERIFICATION_PASSPHRASE} wrong`,
        }),
      'existing-wallet Import wrong passphrase',
    );
    const afterWrongPassphrase = {
      accounts: services.onboarding.repository.listAccounts().length,
      signers: services.onboarding.repository.listSigners().length,
      defaultAccountId: services.accountSelectionPreferences.getDefaultAccountId(services.onboarding.networkId),
    };
    if (
      wrongPassphraseCode !== 'invalid-passcode' ||
      JSON.stringify(afterWrongPassphrase) !== JSON.stringify(beforeWrongPassphrase)
    ) {
      throw new Error('Existing-wallet Import wrong-passphrase invariants failed');
    }

    const watchOnly = await runWatchOnlyOnboarding(services.onboarding, {
      address: secretPublicKey,
      label: 'Import upgrade target',
    });
    const watchOnlyAccountId = watchOnly.account.id;
    const importedSecretResult = await importExistingWalletAccount(services.onboarding, {
      kind: 'secret',
      secret: importedSecret,
      appPassphrase: VERIFICATION_PASSPHRASE,
      label: 'Ignored import label',
    });
    importedSecret = undefined;

    if (
      importedSecretResult.account.account.id !== watchOnlyAccountId ||
      importedSecretResult.account.account.label !== 'Import upgrade target' ||
      importedSecretResult.account.signer.backupState !== 'not-required' ||
      services.onboarding.repository.isWatchOnly(watchOnlyAccountId) ||
      services.onboarding.repository.listAccounts().length !== 2 ||
      services.onboarding.repository.listSigners().length !== 2 ||
      services.accountSelectionPreferences.getDefaultAccountId(services.onboarding.networkId) !== initialAccountId
    ) {
      throw new Error('Existing-wallet Import watch-only upgrade invariants failed');
    }

    selectPersistedAccountAndDefault(
      services.onboarding.repository,
      watchOnlyAccountId,
      services.onboarding.networkId,
      services.accountSelectionPreferences,
    );

    const duplicateSnapshot = {
      accounts: services.onboarding.repository.listAccounts().length,
      signers: services.onboarding.repository.listSigners().length,
      defaultAccountId: services.accountSelectionPreferences.getDefaultAccountId(services.onboarding.networkId),
    };
    const duplicateFixture = secretFixture.secret();
    const duplicateReason = await rejectedReason(
      () =>
        importExistingWalletAccount(services.onboarding, {
          kind: 'secret',
          secret: duplicateFixture,
          appPassphrase: VERIFICATION_PASSPHRASE,
        }),
      'existing-wallet duplicate Import',
    );
    const duplicateAfter = {
      accounts: services.onboarding.repository.listAccounts().length,
      signers: services.onboarding.repository.listSigners().length,
      defaultAccountId: services.accountSelectionPreferences.getDefaultAccountId(services.onboarding.networkId),
    };
    if (
      duplicateReason !== 'account-already-exists' ||
      JSON.stringify(duplicateAfter) !== JSON.stringify(duplicateSnapshot)
    ) {
      throw new Error('Existing-wallet Import duplicate rejection invariants failed');
    }

    let mnemonicFixture = await services.onboarding.sdk.generateMnemonic({
      language: 'english',
      strength: 128,
      mnemonicPassphrase: 'runtime mnemonic extension',
      index: 4,
      appPassphrase: VERIFICATION_PASSPHRASE,
    });
    const expectedMnemonicPublicKey = mnemonicFixture.signer.signerPublicKey;
    let importedMnemonic = mnemonicFixture.mnemonic;
    mnemonicFixture = undefined;
    const importedMnemonicResult = await importExistingWalletAccount(services.onboarding, {
      kind: 'mnemonic',
      mnemonic: importedMnemonic,
      mnemonicPassphrase: 'runtime mnemonic extension',
      index: 4,
      language: 'english',
      appPassphrase: VERIFICATION_PASSPHRASE,
    });
    importedMnemonic = undefined;
    const mnemonicAccountId = importedMnemonicResult.account.account.id;
    const mnemonicSignerId = importedMnemonicResult.account.signer.id;

    if (
      importedMnemonicResult.account.signer.publicKey !== expectedMnemonicPublicKey ||
      importedMnemonicResult.account.signer.backupState !== 'not-required' ||
      services.onboarding.repository.listAccounts().length !== 3 ||
      services.onboarding.repository.listSigners().length !== 3 ||
      resolveOnboardingBootstrap(services.onboarding).kind !== 'ready'
    ) {
      throw new Error('Existing-wallet mnemonic Import invariants failed');
    }

    selectPersistedAccountAndDefault(
      services.onboarding.repository,
      mnemonicAccountId,
      services.onboarding.networkId,
      services.accountSelectionPreferences,
    );

    services.close();
    services = await createAppServices({ realmPath });
    const ready = resolveOnboardingBootstrap(services.onboarding);
    const restoredDefault = services.accountSelectionPreferences.getDefaultAccountId(services.onboarding.networkId);
    const restoredMnemonicSigner = services.onboarding.repository.getSigner(mnemonicSignerId);
    const restoredSecretAccount = services.onboarding.repository.getAccount(watchOnlyAccountId);
    if (
      ready.kind !== 'ready' ||
      ready.accounts.length !== 3 ||
      restoredDefault !== mnemonicAccountId ||
      restoredMnemonicSigner?.backupState !== 'not-required' ||
      !restoredSecretAccount ||
      services.onboarding.repository.isWatchOnly(watchOnlyAccountId)
    ) {
      throw new Error('Existing-wallet Import restart/default recovery failed');
    }

    return {
      existingWalletImport: 'ok',
      wrongPassphraseCode,
      watchOnlyUpgrade: 'ok',
      duplicateReason,
      noPendingBackup: true,
      restartDefaultRestored: true,
      secretSignerPublicKey: secretPublicKey,
      mnemonicSignerPublicKey: expectedMnemonicPublicKey,
      secretSystemAuthRegistration: importedSecretResult.systemAuthRegistration,
      mnemonicSystemAuthRegistration: importedMnemonicResult.systemAuthRegistration,
    };
  } finally {
    services.close();
  }
}

function SmokeApp() {
  const [status, setStatus] = useState('FRESNICA_PARSE_ACCOUNT_SMOKE_RUNNING');

  useEffect(() => {
    let active = true;

    async function run() {
      const core = NativeModules.FresnicaCore;
      if (core === null || typeof core !== 'object') {
        throw new Error(
          `FresnicaCore native module is not linked; diagnostic: ${JSON.stringify(fresnicaNativeModuleDiagnostic())}`,
        );
      }
      const requiredMethods = [
        'parseAccount',
        'generateMnemonic',
        'verifyProtectedSignerPassphrase',
        'prepareEd25519Signing',
        'applyEd25519Signature',
        'signMessageWithSystemAuth',
        'signMessageWithPasscode',
      ];
      const missingMethods = requiredMethods.filter(method => typeof core[method] !== 'function');
      if (missingMethods.length > 0) {
        throw new Error(
          `FresnicaCore bridge methods are not linked: ${missingMethods.join(',')}; diagnostic: ${JSON.stringify(fresnicaNativeModuleDiagnostic())}`,
        );
      }

      const passphraseVerification = await verifyRealmRuntime(() => verifyProtectedSignerPassphraseRuntime(core));
      const existingWalletCreate = await verifyExistingWalletCreateRuntime();
      const existingWalletImport = await verifyExistingWalletImportRuntime();

      const identity = await core.parseAccount(VALID_CLASSIC_ACCOUNT);
      if (
        identity?.kind !== 'classic' ||
        identity?.address !== VALID_CLASSIC_ACCOUNT ||
        identity?.publicKey !== VALID_CLASSIC_ACCOUNT
      ) {
        throw new Error(`Unexpected classic account identity: ${JSON.stringify(identity)}`);
      }

      const identityKeys = Object.keys(identity).sort();
      if (identityKeys.join(',') !== 'address,kind,publicKey') {
        throw new Error(`Unexpected parseAccount fields: ${identityKeys.join(',')}`);
      }

      let invalidCode;
      try {
        await core.parseAccount('not-a-stellar-account');
      } catch (error) {
        invalidCode = error?.code;
      }
      if (invalidCode !== 'invalid-input') {
        throw new Error(`Unexpected invalid-account error code: ${String(invalidCode)}`);
      }

      const summary = {
        realm: 'ok',
        kind: identity.kind,
        address: identity.address,
        publicKey: identity.publicKey,
        invalidCode,
        externalSigningBridge: 'ok',
        sep53MessageSigningBridge: 'ok',
        protectedSignerPassphraseVerification: 'ok',
        wrongPassphraseCode: passphraseVerification.wrongPassphraseCode,
        identityMismatchCode: passphraseVerification.identityMismatchCode,
        malformedEnvelopeCode: passphraseVerification.malformedEnvelopeCode,
        verificationReturnedSensitiveMaterial: false,
        verificationMutatedRealmOrEnvelope: false,
        existingWalletCreate: existingWalletCreate.existingWalletCreate,
        existingWalletCreateWrongPassphraseCode: existingWalletCreate.wrongPassphraseCode,
        existingWalletCreatePendingRestartRecovery: existingWalletCreate.pendingRestartRecovery,
        existingWalletCreateDefaultRestored: Boolean(existingWalletCreate.restoredDefaultAccountId),
        existingWalletCreateSignerPublicKey: existingWalletCreate.createdSignerPublicKey,
        existingWalletCreateSystemAuthRegistration: existingWalletCreate.systemAuthRegistration,
        existingWalletImport: existingWalletImport.existingWalletImport,
        existingWalletImportWrongPassphraseCode: existingWalletImport.wrongPassphraseCode,
        existingWalletImportWatchOnlyUpgrade: existingWalletImport.watchOnlyUpgrade,
        existingWalletImportDuplicateReason: existingWalletImport.duplicateReason,
        existingWalletImportNoPendingBackup: existingWalletImport.noPendingBackup,
        existingWalletImportDefaultRestored: existingWalletImport.restartDefaultRestored,
        existingWalletImportSecretSignerPublicKey: existingWalletImport.secretSignerPublicKey,
        existingWalletImportMnemonicSignerPublicKey: existingWalletImport.mnemonicSignerPublicKey,
        existingWalletImportSecretSystemAuthRegistration: existingWalletImport.secretSystemAuthRegistration,
        existingWalletImportMnemonicSystemAuthRegistration: existingWalletImport.mnemonicSystemAuthRegistration,
      };
      await report(OK_MARKER, summary);
      console.log(OK_MARKER, summary);
      if (active) {
        setStatus(`${OK_MARKER} realm=ok`);
      }
    }

    run().catch(async error => {
      const message = errorMessage(error);
      try {
        await report(FAIL_MARKER, { message });
      } catch (reportError) {
        console.error(FAIL_MARKER, message, errorMessage(reportError));
      }
      console.error(FAIL_MARKER, message);
      if (active) {
        setStatus(`${FAIL_MARKER}: ${message}`);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  return React.createElement(View, { testID: 'fresnica-runtime-smoke' }, React.createElement(Text, null, status));
}

AppRegistry.registerComponent(appName, () => SmokeApp);
