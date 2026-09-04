import React, { useEffect, useState } from 'react';
import Realm from 'realm';
import { AppRegistry, NativeModules, Text, View } from 'react-native';
import { name as appName } from './app.json';

const VALID_CLASSIC_ACCOUNT = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
const OK_MARKER = 'FRESNICA_PARSE_ACCOUNT_SMOKE_OK';
const FAIL_MARKER = 'FRESNICA_PARSE_ACCOUNT_SMOKE_FAIL';
const CALLBACK_BASE_URL = 'http://127.0.0.1:8765';
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

async function verifyRealmRuntime() {
  const realm = await Realm.open({
    schema: [REALM_SMOKE_SCHEMA],
    inMemory: true,
  });

  try {
    realm.write(() => {
      realm.create('RuntimeSmokeRecord', { id: 'smoke', value: 'ok' });
    });
    const record = realm.objectForPrimaryKey('RuntimeSmokeRecord', 'smoke');
    if (record?.value !== 'ok') {
      throw new Error('Realm runtime smoke did not round-trip the record');
    }
  } finally {
    realm.close();
  }
}

function SmokeApp() {
  const [status, setStatus] = useState('FRESNICA_PARSE_ACCOUNT_SMOKE_RUNNING');

  useEffect(() => {
    let active = true;

    async function run() {
      await verifyRealmRuntime();

      const core = NativeModules.FresnicaCore;
      if (core === null || typeof core !== 'object') {
        throw new Error(
          `FresnicaCore native module is not linked; diagnostic: ${JSON.stringify(fresnicaNativeModuleDiagnostic())}`,
        );
      }
      if (typeof core.parseAccount !== 'function') {
        throw new Error(
          `FresnicaCore.parseAccount is not linked; diagnostic: ${JSON.stringify(fresnicaNativeModuleDiagnostic())}`,
        );
      }

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
