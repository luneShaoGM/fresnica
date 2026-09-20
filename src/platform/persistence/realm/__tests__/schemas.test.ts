import {
  ACCOUNT_ENTITY,
  ACCOUNT_SCHEMA,
  ACCOUNT_SIGNER_REFERENCE_ENTITY,
  ACCOUNT_SIGNER_REFERENCE_SCHEMA,
  LOCALE_PREFERENCE_ENTITY,
  LOCALE_PREFERENCE_SCHEMA,
  DEFAULT_ACCOUNT_PREFERENCE_ENTITY,
  DEFAULT_ACCOUNT_PREFERENCE_SCHEMA,
  HISTORY_CACHE_SNAPSHOT_ENTITY,
  HISTORY_CACHE_SNAPSHOT_SCHEMA,
  PENDING_SUBMISSION_ENTITY,
  PENDING_SUBMISSION_SCHEMA,
  SIGNER_ENTITY,
  SIGNER_SCHEMA,
  WALLET_REALM_SCHEMAS,
  WALLET_REALM_SCHEMA_VERSION,
} from '../schemas';

describe('Realm wallet schema v5', () => {
  it('adds replaceable History cache persistence without changing wallet entity identities', () => {
    expect(WALLET_REALM_SCHEMA_VERSION).toBe(5);
    expect(WALLET_REALM_SCHEMAS).toEqual([
      ACCOUNT_SCHEMA,
      SIGNER_SCHEMA,
      ACCOUNT_SIGNER_REFERENCE_SCHEMA,
      LOCALE_PREFERENCE_SCHEMA,
      DEFAULT_ACCOUNT_PREFERENCE_SCHEMA,
      PENDING_SUBMISSION_SCHEMA,
      HISTORY_CACHE_SNAPSHOT_SCHEMA,
    ]);
    expect(ACCOUNT_SCHEMA.name).toBe(ACCOUNT_ENTITY);
    expect(SIGNER_SCHEMA.name).toBe(SIGNER_ENTITY);
    expect(ACCOUNT_SIGNER_REFERENCE_SCHEMA.name).toBe(ACCOUNT_SIGNER_REFERENCE_ENTITY);
    expect(LOCALE_PREFERENCE_SCHEMA.name).toBe(LOCALE_PREFERENCE_ENTITY);
    expect(DEFAULT_ACCOUNT_PREFERENCE_SCHEMA.name).toBe(DEFAULT_ACCOUNT_PREFERENCE_ENTITY);
    expect(PENDING_SUBMISSION_SCHEMA.name).toBe(PENDING_SUBMISSION_ENTITY);
    expect(HISTORY_CACHE_SNAPSHOT_SCHEMA.name).toBe(HISTORY_CACHE_SNAPSHOT_ENTITY);
  });

  it('stores Account fields one-to-one without persisting derived watch-only state', () => {
    expect(ACCOUNT_SCHEMA).toEqual({
      name: 'AccountEntity',
      primaryKey: 'id',
      properties: {
        id: 'string',
        address: 'string',
        identityKind: 'string',
        networkId: 'string',
        label: 'string',
        sortOrder: 'int',
        hidden: 'bool',
        createdAt: 'date',
        updatedAt: 'date',
      },
    });
    expect(ACCOUNT_SCHEMA.properties).not.toHaveProperty('watchOnly');
  });

  it('stores only the approved Signer persistence surface', () => {
    expect(SIGNER_SCHEMA).toEqual({
      name: 'SignerEntity',
      primaryKey: 'id',
      properties: {
        id: 'string',
        publicKey: 'string',
        kind: 'string',
        envelopeJson: 'string?',
        envelopeRevision: 'string?',
        recoveryKind: 'string?',
        backupState: 'string?',
        providerId: 'string?',
        providerMetadataJson: 'string?',
        createdAt: 'date',
        updatedAt: 'date',
      },
    });

    for (const forbidden of [
      'passphrase',
      'appPasscode',
      'mnemonic',
      'secret',
      'walletUnlockKey',
      'decryptedSignerMaterial',
      'biometricCipher',
    ]) {
      expect(SIGNER_SCHEMA.properties).not.toHaveProperty(forbidden);
    }
  });

  it('stores account-signer relationships by stable ids instead of Realm object links', () => {
    expect(ACCOUNT_SIGNER_REFERENCE_SCHEMA).toEqual({
      name: 'AccountSignerReferenceEntity',
      primaryKey: 'id',
      properties: {
        id: 'string',
        accountId: 'string',
        signerId: 'string',
        createdAt: 'date',
      },
    });
  });

  it('persists only the selected locale and its update timestamp', () => {
    expect(LOCALE_PREFERENCE_SCHEMA).toEqual({
      name: 'LocalePreferenceEntity',
      primaryKey: 'id',
      properties: {
        id: 'string',
        locale: 'string',
        updatedAt: 'date',
      },
    });
  });

  it('persists default-account identity by network instead of on Account records', () => {
    expect(DEFAULT_ACCOUNT_PREFERENCE_SCHEMA).toEqual({
      name: 'DefaultAccountPreferenceEntity',
      primaryKey: 'networkId',
      properties: {
        networkId: 'string',
        accountId: 'string',
        updatedAt: 'date',
      },
    });
    expect(ACCOUNT_SCHEMA.properties).not.toHaveProperty('defaultAccountId');
  });

  it('persists History cache as a replaceable normalized snapshot blob', () => {
    expect(HISTORY_CACHE_SNAPSHOT_SCHEMA).toEqual({
      name: 'HistoryCacheSnapshotEntity',
      primaryKey: 'id',
      properties: {
        id: 'string',
        networkId: 'string',
        accountAddress: 'string',
        schemaVersion: 'int',
        lastSuccessfulHorizonUpdateAt: 'date',
        entriesJson: 'string',
        detailsJson: 'string',
      },
    });
    expect(HISTORY_CACHE_SNAPSHOT_SCHEMA.properties).not.toHaveProperty('cursor');
    expect(HISTORY_CACHE_SNAPSHOT_SCHEMA.properties).not.toHaveProperty('acceptedCursors');
    expect(HISTORY_CACHE_SNAPSHOT_SCHEMA.properties).not.toHaveProperty('rawHorizon');
  });

  it('persists only public pending-submission recovery metadata', () => {
    expect(PENDING_SUBMISSION_SCHEMA).toEqual({
      name: 'PendingSubmissionEntity',
      primaryKey: 'id',
      properties: {
        id: 'string',
        networkId: 'string',
        accountId: 'string',
        sourceAddress: 'string',
        transactionHash: 'string',
        intentKind: 'string',
        intentKey: 'string',
        state: 'string',
        createdAt: 'date',
        updatedAt: 'date',
        lastCheckedAt: 'date?',
        ledger: 'int?',
        resultCode: 'string?',
      },
    });

    for (const forbidden of [
      'transactionXdr',
      'signedTransactionXdr',
      'passphrase',
      'secret',
      'mnemonic',
      'walletUnlockKey',
      'signature',
    ]) {
      expect(PENDING_SUBMISSION_SCHEMA.properties).not.toHaveProperty(forbidden);
    }
  });
});
