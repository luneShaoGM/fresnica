import type {FresnicaSdk} from '../../platform/fresnica/FresnicaSdk';
import type {AccountSignerRepository} from './AccountSignerRepository';
import type {AccountRecord} from './types';
import type {SignerRecord} from '../signer/types';

export type ProvisionRecordIdFactory = (kind: 'account' | 'signer') => string;

export type ProvisionAccountDependencies = {
  sdk: FresnicaSdk;
  repository: AccountSignerRepository;
  createId: ProvisionRecordIdFactory;
  now: () => Date;
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

export type ProvisionedAccount = {
  account: AccountRecord;
  signer: SignerRecord;
};

export type GeneratedProvisionedAccount = ProvisionedAccount & {
  mnemonic: string;
  language: string;
  index: number;
};

export async function importSecretAccount(
  dependencies: ProvisionAccountDependencies,
  input: ImportSecretAccountInput,
): Promise<ProvisionedAccount> {
  const protectedSigner = await dependencies.sdk.protectSecret({
    secret: input.secret,
    appPasscode: input.appPassphrase,
  });

  return persistProtectedSigner(dependencies, protectedSigner, {
    networkId: input.networkId,
    label: input.label,
    recoveryKind: 'secret',
    backupState: 'not-required',
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
    appPasscode: input.appPassphrase,
  });

  return persistProtectedSigner(dependencies, protectedSigner, {
    networkId: input.networkId,
    label: input.label,
    recoveryKind: 'mnemonic',
    backupState: 'confirmed',
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
    appPasscode: input.appPassphrase,
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

type PersistProtectedSignerOptions = {
  networkId: string;
  label?: string;
  recoveryKind: 'mnemonic' | 'secret';
  backupState: 'pending' | 'confirmed' | 'not-required';
};

async function persistProtectedSigner(
  dependencies: ProvisionAccountDependencies,
  protectedSigner: {signerPublicKey: string; envelopeJson: string},
  options: PersistProtectedSignerOptions,
): Promise<ProvisionedAccount> {
  const networkId = requireNonEmpty(options.networkId, 'networkId');
  const identity = await dependencies.sdk.parseAccount(protectedSigner.signerPublicKey);

  if (identity.kind !== 'classic') {
    throw new Error('unsupported-account-kind');
  }

  const now = dependencies.now();
  const account: AccountRecord = {
    id: requireRecordId(dependencies.createId('account'), 'account'),
    address: identity.address,
    identityKind: 'classic',
    networkId,
    label: options.label?.trim() ?? '',
    sortOrder: 0,
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
    backupState: options.backupState,
    createdAt: now,
    updatedAt: now,
  };

  dependencies.repository.createAccountWithSigner({
    account,
    signer,
    attachedAt: now,
  });

  return {account, signer};
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
