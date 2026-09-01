import type {AccountSignerRepository} from '../account/AccountSignerRepository';
import type {FresnicaSdk} from '../../platform/fresnica/FresnicaSdk';
import type {RevealedSigningMaterial} from '../../platform/fresnica/types';
import type {RecoveryKind, SignerKind} from './types';

export type RecoveryExportDependencies = Readonly<{
  sdk: FresnicaSdk;
  repository: AccountSignerRepository;
}>;

export type RecoveryExportAccess =
  | Readonly<{
      status: 'available';
      signerId: string;
      signerPublicKey: string;
      recoveryKind: RecoveryKind;
    }>
  | Readonly<{status: 'watch-only'}>
  | Readonly<{status: 'unsupported-multiple-signers'}>
  | Readonly<{status: 'unsupported-signer'; signerKind: SignerKind}>
  | Readonly<{status: 'incomplete-protected-signer'}>;

export function resolveRecoveryExportAccess(
  dependencies: RecoveryExportDependencies,
  accountId: string,
): RecoveryExportAccess {
  if (!dependencies.repository.getAccount(accountId)) {
    throw new Error('account-not-found');
  }

  const signers = dependencies.repository.listSignersForAccount(accountId);
  if (signers.length === 0) {
    return {status: 'watch-only'};
  }
  if (signers.length > 1) {
    return {status: 'unsupported-multiple-signers'};
  }

  const signer = signers[0];
  if (signer.kind !== 'protected-software') {
    return {status: 'unsupported-signer', signerKind: signer.kind};
  }
  if (!signer.envelopeJson || !signer.recoveryKind) {
    return {status: 'incomplete-protected-signer'};
  }

  return {
    status: 'available',
    signerId: signer.id,
    signerPublicKey: signer.publicKey,
    recoveryKind: signer.recoveryKind,
  };
}

export async function revealAccountRecoveryMaterial(
  dependencies: RecoveryExportDependencies,
  accountId: string,
  freshAppPassphrase: string,
): Promise<RevealedSigningMaterial> {
  if (freshAppPassphrase.length === 0) {
    throw new Error('recovery-export-passphrase-required');
  }

  const access = resolveRecoveryExportAccess(dependencies, accountId);
  if (access.status !== 'available') {
    throw new Error(`recovery-export-${access.status}`);
  }

  const signer = dependencies.repository.getSigner(access.signerId);
  if (!signer?.envelopeJson) {
    throw new Error('recovery-export-signer-unavailable');
  }

  const revealed = await dependencies.sdk.reveal({
    envelopeJson: signer.envelopeJson,
    freshAppPasscode: freshAppPassphrase,
    expectedSignerPublicKey: access.signerPublicKey,
  });

  if (revealed.kind !== access.recoveryKind) {
    throw new Error('recovery-export-kind-mismatch');
  }

  return revealed;
}
