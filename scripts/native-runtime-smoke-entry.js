import React, { useEffect, useState } from 'react';
import Realm from 'realm';
import { AppRegistry, NativeModules, Text, View } from 'react-native';
import { name as appName } from './app.json';

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

async function verifyProtectedSignerPassphraseRuntime(core) {
  let generated = await core.generateMnemonic(
    'english',
    128,
    '',
    0,
    VERIFICATION_PASSPHRASE,
  );
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
      core.verifyProtectedSignerPassphrase(
        envelopeBefore,
        `${VERIFICATION_PASSPHRASE} wrong`,
        signer.signerPublicKey,
      ),
    'wrong passphrase verification',
  );
  if (wrongPassphraseCode !== 'invalid-passcode') {
    throw new Error(`Unexpected wrong-passphrase error code: ${String(wrongPassphraseCode)}`);
  }

  const identityMismatchCode = await rejectedCode(
    () =>
      core.verifyProtectedSignerPassphrase(
        envelopeBefore,
        VERIFICATION_PASSPHRASE,
        VALID_CLASSIC_ACCOUNT,
      ),
    'identity-mismatch verification',
  );
  const malformedEnvelopeCode = await rejectedCode(
    () =>
      core.verifyProtectedSignerPassphrase(
        'not-a-protected-envelope',
        VERIFICATION_PASSPHRASE,
        signer.signerPublicKey,
      ),
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

      const passphraseVerification = await verifyRealmRuntime(() =>
        verifyProtectedSignerPassphraseRuntime(core),
      );

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
