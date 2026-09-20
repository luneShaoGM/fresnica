import type Realm from 'realm';

export const WALLET_REALM_SCHEMA_VERSION = 5;

export const ACCOUNT_ENTITY = 'AccountEntity';
export const SIGNER_ENTITY = 'SignerEntity';
export const ACCOUNT_SIGNER_REFERENCE_ENTITY = 'AccountSignerReferenceEntity';
export const LOCALE_PREFERENCE_ENTITY = 'LocalePreferenceEntity';
export const DEFAULT_ACCOUNT_PREFERENCE_ENTITY = 'DefaultAccountPreferenceEntity';
export const PENDING_SUBMISSION_ENTITY = 'PendingSubmissionEntity';
export const HISTORY_CACHE_SNAPSHOT_ENTITY = 'HistoryCacheSnapshotEntity';

export const ACCOUNT_SCHEMA = {
  name: ACCOUNT_ENTITY,
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
} satisfies Realm.ObjectSchema;

export const SIGNER_SCHEMA = {
  name: SIGNER_ENTITY,
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
} satisfies Realm.ObjectSchema;

export const ACCOUNT_SIGNER_REFERENCE_SCHEMA = {
  name: ACCOUNT_SIGNER_REFERENCE_ENTITY,
  primaryKey: 'id',
  properties: {
    id: 'string',
    accountId: 'string',
    signerId: 'string',
    createdAt: 'date',
  },
} satisfies Realm.ObjectSchema;

export const LOCALE_PREFERENCE_SCHEMA = {
  name: LOCALE_PREFERENCE_ENTITY,
  primaryKey: 'id',
  properties: {
    id: 'string',
    locale: 'string',
    updatedAt: 'date',
  },
} satisfies Realm.ObjectSchema;

export const DEFAULT_ACCOUNT_PREFERENCE_SCHEMA = {
  name: DEFAULT_ACCOUNT_PREFERENCE_ENTITY,
  primaryKey: 'networkId',
  properties: {
    networkId: 'string',
    accountId: 'string',
    updatedAt: 'date',
  },
} satisfies Realm.ObjectSchema;

export const PENDING_SUBMISSION_SCHEMA = {
  name: PENDING_SUBMISSION_ENTITY,
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
} satisfies Realm.ObjectSchema;

export const HISTORY_CACHE_SNAPSHOT_SCHEMA = {
  name: HISTORY_CACHE_SNAPSHOT_ENTITY,
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
} satisfies Realm.ObjectSchema;

export const WALLET_REALM_SCHEMAS = [
  ACCOUNT_SCHEMA,
  SIGNER_SCHEMA,
  ACCOUNT_SIGNER_REFERENCE_SCHEMA,
  LOCALE_PREFERENCE_SCHEMA,
  DEFAULT_ACCOUNT_PREFERENCE_SCHEMA,
  PENDING_SUBMISSION_SCHEMA,
  HISTORY_CACHE_SNAPSHOT_SCHEMA,
] as const;
