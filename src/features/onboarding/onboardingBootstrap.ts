import type {ProvisionAccountDependencies} from '../../capabilities/account/provisionAccount';
import type {AccountRecord} from '../../capabilities/account/types';
import type {SignerRecord} from '../../capabilities/signer/types';

export type OnboardingBootstrapState =
  | Readonly<{kind: 'onboarding'}>
  | Readonly<{
      kind: 'pending-mnemonic-backup';
      accountId: string;
      signerId: string;
      signerPublicKey: string;
    }>
  | Readonly<{kind: 'ready'; accounts: AccountRecord[]}>;

export type RecoveredMnemonicBackup = Readonly<{
  mnemonic: string;
  language?: string;
  index?: number;
}>;

export function resolveOnboardingBootstrap(
  dependencies: ProvisionAccountDependencies,
): OnboardingBootstrapState {
  const accounts = dependencies.repository.listAccounts();
  if (accounts.length === 0) {
    return {kind: 'onboarding'};
  }

  const pendingMnemonicSigners = dependencies.repository
    .listSigners()
    .filter(isPendingMnemonicSigner);

  if (pendingMnemonicSigners.length > 1) {
    throw new Error('multiple-pending-mnemonic-backups');
  }

  const pending = pendingMnemonicSigners[0];
  if (pending) {
    const attachedAccounts = accounts.filter(account =>
      dependencies.repository
        .listSignersForAccount(account.id)
        .some(signer => signer.id === pending.id),
    );
    if (attachedAccounts.length !== 1) {
      throw new Error('pending-mnemonic-backup-account-invalid');
    }
    return {
      kind: 'pending-mnemonic-backup',
      accountId: attachedAccounts[0].id,
      signerId: pending.id,
      signerPublicKey: pending.publicKey,
    };
  }

  return {kind: 'ready', accounts};
}

export async function recoverPendingMnemonicBackup(
  dependencies: ProvisionAccountDependencies,
  signerId: string,
  appPassphrase: string,
): Promise<RecoveredMnemonicBackup> {
  const signer = dependencies.repository.getSigner(signerId);
  if (!signer) {
    throw new Error('signer-not-found');
  }
  if (
    signer.kind !== 'protected-software' ||
    signer.recoveryKind !== 'mnemonic' ||
    signer.backupState !== 'pending' ||
    !signer.envelopeJson
  ) {
    throw new Error('pending-mnemonic-backup-not-found');
  }

  const revealed = await dependencies.sdk.reveal({
    envelopeJson: signer.envelopeJson,
    freshAppPassphrase: appPassphrase,
    expectedSignerPublicKey: signer.publicKey,
  });

  if (revealed.kind !== 'mnemonic') {
    throw new Error('unexpected-recovery-material');
  }

  return {
    mnemonic: revealed.mnemonic,
    ...(revealed.language === undefined ? {} : {language: revealed.language}),
    ...(revealed.index === undefined ? {} : {index: revealed.index}),
  };
}

export function confirmMnemonicBackup(
  dependencies: ProvisionAccountDependencies,
  signerId: string,
): void {
  dependencies.repository.setSignerBackupState(
    signerId,
    'confirmed',
    dependencies.now(),
  );
}

export async function completeMnemonicBackup(
  dependencies: ProvisionAccountDependencies,
  signerId: string,
  onComplete: () => void | Promise<void>,
): Promise<void> {
  confirmMnemonicBackup(dependencies, signerId);
  try {
    await onComplete();
  } catch (error) {
    dependencies.repository.setSignerBackupState(
      signerId,
      'pending',
      dependencies.now(),
    );
    throw error;
  }
}

function isPendingMnemonicSigner(signer: SignerRecord): boolean {
  return (
    signer.kind === 'protected-software' &&
    signer.recoveryKind === 'mnemonic' &&
    signer.backupState === 'pending'
  );
}
