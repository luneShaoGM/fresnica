import type { FresnicaSdkPort } from '../ports/FresnicaSdkPort';
import type { AccountSignerRepository } from './AccountSignerRepository';
import { nextAccountSortOrder } from './accountOrder';
import type { AccountRecord } from './types';
import type { BackupState, RecoveryKind, SignerRecord } from '../signer/types';
import { protectedSignerVerificationIdentity } from '../application-security/verifyExistingAppPassphrase';

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

// One repository owner spans credential authorization and protected writes.
// A remounted route shares only settlement, never credentials or results.
const protectedProvisions = new WeakMap<AccountSignerRepository, Promise<void>>();
const provisioningObservers = new WeakMap<AccountSignerRepository, Set<() => void>>();

export function isProtectedAccountProvisioning(repository: AccountSignerRepository): boolean {
  return protectedProvisions.has(repository);
}

export class AccountProvisioningInProgressError extends Error {
  constructor() {
    super('account-provisioning-in-progress');
  }
}

type ProvisionAuthorization = () => void | Promise<void>;

export function subscribeProtectedAccountProvisioning(
  repository: AccountSignerRepository,
  onSettled: () => void,
): () => void {
  const observers = provisioningObservers.get(repository) ?? new Set<() => void>();
  provisioningObservers.set(repository, observers);
  observers.add(onSettled);
  return () => {
    observers.delete(onSettled);
    if (!observers.size && provisioningObservers.get(repository) === observers) {
      provisioningObservers.delete(repository);
    }
  };
}

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
  authorize?: ProvisionAuthorization,
): Promise<ProvisionedAccount> {
  return runProtectedProvisioning(dependencies.repository, authorize, async assertProtectionCurrent => {
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
      assertProtectionCurrent,
    });
  });
}

export async function importMnemonicAccount(
  dependencies: ProvisionAccountDependencies,
  input: ImportMnemonicAccountInput,
  authorize?: ProvisionAuthorization,
): Promise<ProvisionedAccount> {
  return runProtectedProvisioning(dependencies.repository, authorize, async assertProtectionCurrent => {
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
      assertProtectionCurrent,
    });
  });
}

export async function generateMnemonicAccount(
  dependencies: ProvisionAccountDependencies,
  input: GenerateMnemonicAccountInput,
  authorize?: ProvisionAuthorization,
): Promise<GeneratedProvisionedAccount> {
  return runProtectedProvisioning(dependencies.repository, authorize, async assertProtectionCurrent => {
    assertNoPendingMnemonicBackup(dependencies.repository);
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
      assertProtectionCurrent,
    });

    return {
      ...persisted,
      mnemonic: generated.mnemonic,
      language: generated.language,
      index: generated.index,
    };
  });
}

export async function deriveMnemonicAccount(
  dependencies: ProvisionAccountDependencies,
  input: DeriveMnemonicAccountInput,
): Promise<ProvisionedAccount> {
  // The existing derive SDK call owns fresh source-passphrase authorization.
  return runProtectedProvisioning(dependencies.repository, undefined, async assertProtectionCurrent => {
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
      assertProtectionCurrent,
    });
  });
}

async function runProtectedProvisioning<T>(
  repository: AccountSignerRepository,
  authorize: ProvisionAuthorization | undefined,
  provision: (assertProtectionCurrent: () => void) => Promise<T>,
): Promise<T> {
  const active = protectedProvisions.get(repository);
  if (active) {
    await active;
    // The caller must reconcile current public state and explicitly retry.
    // It must never run an authorization decision made before this owner.
    throw new AccountProvisioningInProgressError();
  }
  let settle!: () => void;
  const completion = new Promise<void>(resolve => { settle = resolve; });
  protectedProvisions.set(repository, completion);
  try {
    const protectionIdentity = protectedSignerVerificationIdentity(repository);
    const assertProtectionCurrent = () => {
      if (protectedSignerVerificationIdentity(repository) !== protectionIdentity) {
        throw new Error('account-protection-changed');
      }
    };
    if (authorize) await authorize();
    assertProtectionCurrent();
    return await provision(assertProtectionCurrent);
  } finally {
    protectedProvisions.delete(repository);
    settle();
    for (const observer of [...(provisioningObservers.get(repository) ?? [])]) {
      try {
        observer();
      } catch {
        // Presentation observers cannot change a persistence result or leave
        // another caller behind this operation's duplicate gate.
      }
    }
  }
}

type PersistProtectedSignerOptions = {
  networkId: string;
  label?: string;
  recoveryKind: RecoveryKind;
  backupState?: BackupState;
  duplicatePolicy?: 'reject' | 'upgrade-watch-only';
  assertProtectionCurrent: () => void;
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

  const existingAccounts =
    options.duplicatePolicy === 'upgrade-watch-only'
      ? dependencies.repository
          .listAccounts()
          .filter(account => account.networkId === networkId && account.address === identity.address)
      : [];
  // Legacy duplicate identities retain independent metadata and signer references.
  if (existingAccounts.length > 1) throw new Error('account-already-exists');
  const existingAccount = existingAccounts[0];

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

  if (options.recoveryKind === 'mnemonic' && options.backupState === 'pending') {
    // Recheck after the asynchronous SDK parse, immediately before the
    // synchronous write, including changes made through another repo handle.
    assertNoPendingMnemonicBackup(dependencies.repository);
  }
  options.assertProtectionCurrent();

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

function assertNoPendingMnemonicBackup(repository: AccountSignerRepository): void {
  if (repository.listSigners().some(signer => signer.kind === 'protected-software'
    && signer.recoveryKind === 'mnemonic' && signer.backupState === 'pending')) {
    throw new Error('pending-mnemonic-backup-exists');
  }
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
