import type {
  AccountIdentityKind,
  AccountRecord,
  AccountSignerReference,
} from '../../../capabilities/account/types';
import type {
  BackupState,
  RecoveryKind,
  SignerKind,
  SignerRecord,
} from '../../../capabilities/signer/types';
import type {
  PersistedAccount,
  PersistedAccountSignerReference,
  PersistedSigner,
} from './types';

const ACCOUNT_IDENTITY_KINDS = new Set<AccountIdentityKind>([
  'classic',
  'contract',
]);
const SIGNER_KINDS = new Set<SignerKind>([
  'protected-software',
  'hardware',
  'external',
]);
const RECOVERY_KINDS = new Set<RecoveryKind>(['mnemonic', 'secret']);
const BACKUP_STATES = new Set<BackupState>([
  'pending',
  'confirmed',
  'not-required',
]);

function optionalString(value: string | null | undefined): string | undefined {
  return value ?? undefined;
}

export function mapAccountFromRealm(record: PersistedAccount): AccountRecord {
  if (!ACCOUNT_IDENTITY_KINDS.has(record.identityKind as AccountIdentityKind)) {
    throw new Error('invalid-persisted-account');
  }

  return {
    id: record.id,
    address: record.address,
    identityKind: record.identityKind as AccountIdentityKind,
    networkId: record.networkId,
    label: record.label,
    sortOrder: record.sortOrder,
    hidden: record.hidden,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
  };
}

export function mapSignerFromRealm(record: PersistedSigner): SignerRecord {
  if (!SIGNER_KINDS.has(record.kind as SignerKind)) {
    throw new Error('invalid-persisted-signer');
  }
  if (
    record.recoveryKind != null &&
    !RECOVERY_KINDS.has(record.recoveryKind as RecoveryKind)
  ) {
    throw new Error('invalid-persisted-signer');
  }
  if (
    record.backupState != null &&
    !BACKUP_STATES.has(record.backupState as BackupState)
  ) {
    throw new Error('invalid-persisted-signer');
  }

  return {
    id: record.id,
    publicKey: record.publicKey,
    kind: record.kind as SignerKind,
    envelopeJson: optionalString(record.envelopeJson),
    envelopeRevision: optionalString(record.envelopeRevision),
    recoveryKind: optionalString(record.recoveryKind) as RecoveryKind | undefined,
    backupState: optionalString(record.backupState) as BackupState | undefined,
    providerId: optionalString(record.providerId),
    providerMetadataJson: optionalString(record.providerMetadataJson),
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
  };
}

export function mapAccountSignerReferenceFromRealm(
  record: PersistedAccountSignerReference,
): AccountSignerReference {
  return {
    id: record.id,
    accountId: record.accountId,
    signerId: record.signerId,
    createdAt: new Date(record.createdAt),
  };
}
