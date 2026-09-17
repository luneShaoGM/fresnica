import type { FresnicaSdkPort } from '../ports/FresnicaSdkPort';
import type { AccountSignerRepository } from './AccountSignerRepository';
import { nextAccountSortOrder } from './accountOrder';
import type { AccountRecord } from './types';
import type { BackupState, RecoveryKind, SignerRecord } from '../signer/types';

export type ProvisionRecordIdFactory = (kind: 'account' | 'signer') => string;

export type ProvisionAccountDependencies = {
  sdk: FresnicaSdkPort;
  repository: AccountSignerRepository;
  createId: ProvisionRecordIdFactory;
  now: () => Date;
};

export type WatchOnlyAccountInput = {
  address: string;
  networkId: string;
  label?: string;
};

export type ProvisionAccountBaseInput = {
  appPassphrase: string;
  networkId: string;
  label?: string;
};

export type ImportSecretAccountInput = ProvisionAccountBaseInput & {
  secret: string;
};

export type ImportMnemonicAccountInput = ProvisionAccountBaseInput & {
  mnemonic: string;
  mnemonicPassphrase: string;
  index: number;
  language?: string;
};

export type GenerateMnemonicAccountInput = ProvisionAccountBaseInput & {
  language: string;
  strength: number;
  mnemonicPassphrase: string;
  index: number;
};

export type DeriveMnemonicAccountInput = ProvisionAccountBaseInput & {
  sourceEnvelopeJson: string;
  expectedSourceSignerPublicKey: string;
  index: number;
  backupState: Extract<BackupState, 'confirmed' | 'not-required'>;
};

export type ProvisionedAccount = {
  account: AccountRecord;
  signer: SignerRecord;
};

export type GeneratedProvisionedAccount = ProvisionedAccount & {
  mnemonic: string;
  language: string;
  index: number;
};

export async function registerWatchOnlyAccount(
  dependencies: ProvisionAccountDependencies,
  input: WatchOnlyAccountInput,
): Promise<AccountRecord> {
  const networkId = requireNonEmpty(input.networkId, 'networkId');
  const identity = await dependencies.sdk.parseAccount(input.address);
  const now = dependencies.now();
  const account: AccountRecord = {
    id: requireRecordId(dependencies.createId('account'), 'account'),
    address: identity.address,
    identityKind: identity.kind,
    networkId,
    label: input.label?.trim() ?? '',
    sortOrder: nextAccountSortOrder(dependencies.repository.listAccounts()),
    hidden: false,
    createdAt: now,
    updatedAt: now,
  };

  dependencies.repository.createAccount(account);
  return account;
}

export async function importSecretAccount(
  dependencies: ProvisionAccountDependencies,
  input: ImportSecretAccountInput,
): Promise<ProvisionedAccount> {
  const protectedSigner = await dependencies.sdk.protectSecret({
    secret: input.secret,
    appPassphrase: input.appPassphrase,
  });

  return persistProtectedSigner(dependencies, protectedSigner, {
    networkId: input.networkId,
    label: input.label,
    recoveryKind: 'secret',
    backupState: 'not-required',
    duplicatePolicy: 'upgrade-watch-only',
  });
}

export async function importMnemonicAccount(
  dependencies: ProvisionAccountDependencies,
  input: ImportMnemonicAccountInput,
): Promise<ProvisionedAccount> {
  const protectedSigner = await dependencies.sdk.protectMnemonic({
    mnemonic: input.mnemonic,
    mnemonicPassphrase: input.mnemonicPassphrase,
    index: input.index,
    language: input.language,
    appPassphrase: input.appPassphrase,
  });

  return persistProtectedSigner(dependencies, protectedSigner, {
    networkId: input.networkId,
    label: input.label,
    recoveryKind: 'mnemonic',
    backupState: 'not-required',
    duplicatePolicy: 'upgrade-watch-only',
  });
}

export async function generateMnemonicAccount(
  dependencies: ProvisionAccountDependencies,
  input: GenerateMnemonicAccountInput,
): Promise<GeneratedProvisionedAccount> {
  const generated = await dependencies.sdk.generateMnemonic({
    language: input.language,
    strength: input.strength,
    mnemonicPassphrase: input.mnemonicPassphrase,
    index: input.index,
    appPassphrase: input.appPassphrase,
  });

  const persisted = await persistProtectedSigner(dependencies, generated.signer, {
    networkId: input.networkId,
    label: input.label,
    recoveryKind: 'mnemonic',
    backupState: 'pending',
  });

  return {
    ...persisted,
    mnemonic: generated.mnemonic,
    language: generated.language,
    index: generated.index,
  };
}

export async function deriveMnemonicAccount(
  dependencies: ProvisionAccountDependencies,
  input: DeriveMnemonicAccountInput,
): Promise<ProvisionedAccount> {
  const protectedSigner = await dependencies.sdk.deriveMnemonicSigner({
    sourceEnvelopeJson: input.sourceEnvelopeJson,
    appPassphrase: input.appPassphrase,
    expectedSourceSignerPublicKey: input.expectedSourceSignerPublicKey,
    index: input.index,
  });

  return persistProtectedSigner(dependencies, protectedSigner, {
    networkId: input.networkId,
    label: input.label,
    recoveryKind: 'mnemonic',
    backupState: input.backupState,
    duplicatePolicy: 'upgrade-watch-only',
  });
}

type PersistProtectedSignerOptions = {
  networkId: string;
  label?: string;
  recoveryKind: RecoveryKind;
  backupState?: BackupState;
  duplicatePolicy?: 'reject' | 'upgrade-watch-only';
};

async function persistProtectedSigner(
  dependencies: ProvisionAccountDependencies,
  protectedSigner: { signerPublicKey: string; envelopeJson: string },
  options: PersistProtectedSignerOptions,
): Promise<ProvisionedAccount> {
  const networkId = requireNonEmpty(options.networkId, 'networkId');
  const identity = await dependencies.sdk.parseAccount(protectedSigner.signerPublicKey);

  if (identity.kind !== 'classic') {
    throw new Error('unsupported-account-kind');
  }

  const existingAccount =
    options.duplicatePolicy === 'upgrade-watch-only'
      ? dependencies.repository
          .listAccounts()
          .find(account => account.networkId === networkId && account.address === identity.address)
      : undefined;

  if (existingAccount && !dependencies.repository.isWatchOnly(existingAccount.id)) {
    throw new Error('account-already-exists');
  }
  if (existingAccount?.hidden) {
    throw new Error('account-not-selectable');
  }

  const now = dependencies.now();
  const account: AccountRecord = existingAccount ?? {
    id: requireRecordId(dependencies.createId('account'), 'account'),
    address: identity.address,
    identityKind: 'classic',
    networkId,
    label: options.label?.trim() ?? '',
    sortOrder: nextAccountSortOrder(dependencies.repository.listAccounts()),
    hidden: false,
    createdAt: now,
    updatedAt: now,
  };
  const signer: SignerRecord = {
    id: requireRecordId(dependencies.createId('signer'), 'signer'),
    publicKey: protectedSigner.signerPublicKey,
    kind: 'protected-software',
    envelopeJson: protectedSigner.envelopeJson,
    recoveryKind: options.recoveryKind,
    ...(options.backupState === undefined ? {} : { backupState: options.backupState }),
    createdAt: now,
    updatedAt: now,
  };

  if (existingAccount) {
    try {
      dependencies.repository.upgradeWatchOnlyAccountWithSigner({
        accountId: existingAccount.id,
        signer,
        attachedAt: now,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'account-not-watch-only') {
        throw new Error('account-already-exists');
      }
      throw error;
    }
  } else {
    dependencies.repository.createAccountWithSigner({
      account,
      signer,
      attachedAt: now,
    });
  }

  return { account, signer };
}

function requireNonEmpty(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`invalid-${field}`);
  }
  return normalized;
}

function requireRecordId(value: string, kind: 'account' | 'signer'): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`invalid-${kind}-record-id`);
  }
  return normalized;
}
