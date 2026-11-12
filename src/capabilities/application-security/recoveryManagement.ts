import type { AccountSignerRepository } from '../account/AccountSignerRepository';
import type { FresnicaSdkPort } from '../ports/FresnicaSdkPort';
import type { ProtectedSigner, RevealedSigningMaterial } from '../ports/fresnicaTypes';
import type { SignerRecord } from '../signer/types';
import { assertNewProtectionPassphrase } from './newPassphrasePolicy';

export type ProtectionUpdate = Readonly<{ id: string; protectedSigner: ProtectedSigner }>;
export interface RecoveryRepository extends AccountSignerRepository {
  replaceProtection(expected: readonly SignerRecord[], updates: readonly ProtectionUpdate[], now: Date): void;
}
export type RecoveryManagementDependencies = Readonly<{
  sdk: FresnicaSdkPort;
  repository: RecoveryRepository;
  hasUnresolvedSubmission: () => boolean;
  assertCurrent: () => void;
  now: () => Date;
}>;
const rotating = new WeakSet<RecoveryRepository>();
export function signerInventory(signers: readonly SignerRecord[]): string {
  return JSON.stringify([...signers].sort((a, b) => a.id.localeCompare(b.id)));
}
export function recoverySigners(repository: AccountSignerRepository, accountId: string): SignerRecord[] {
  if (!repository.getAccount(accountId)) return [];
  return repository
    .listSignersForAccount(accountId)
    .filter(
      s =>
        s.kind === 'protected-software' &&
        Boolean(s.envelopeJson) &&
        (s.recoveryKind === 'mnemonic' || s.recoveryKind === 'secret') &&
        s.backupState !== 'pending',
    );
}
export async function revealRecoveryMaterial(
  deps: RecoveryManagementDependencies,
  input: Readonly<{ accountId: string; signerId: string; passphrase: string; signal: AbortSignal }>,
): Promise<RevealedSigningMaterial> {
  deps.assertCurrent();
  if (input.signal.aborted || rotating.has(deps.repository)) throw new Error('recovery-unavailable');
  const before = signerInventory(deps.repository.listSigners());
  const signer = recoverySigners(deps.repository, input.accountId).find(s => s.id === input.signerId);
  if (!signer?.envelopeJson || !input.passphrase) throw new Error('recovery-unavailable');
  const material = await deps.sdk.reveal({
    envelopeJson: signer.envelopeJson,
    expectedSignerPublicKey: signer.publicKey,
    freshAppPassphrase: input.passphrase,
  });
  deps.assertCurrent();
  if (
    input.signal.aborted ||
    rotating.has(deps.repository) ||
    before !== signerInventory(deps.repository.listSigners()) ||
    material.kind !== signer.recoveryKind
  )
    throw new Error('recovery-context-changed');
  if (material.kind === 'secret' ? !material.secret : !material.mnemonic) throw new Error('recovery-unavailable');
  return material;
}
export async function changeWalletPassphrase(
  deps: RecoveryManagementDependencies,
  input: Readonly<{ currentPassphrase: string; newPassphrase: string; confirmation: string; signal: AbortSignal }>,
): Promise<void> {
  assertNewProtectionPassphrase(input.newPassphrase);
  if (
    !input.currentPassphrase ||
    input.newPassphrase !== input.confirmation ||
    input.newPassphrase === input.currentPassphrase
  )
    throw new Error('passphrase-confirmation-invalid');
  if (rotating.has(deps.repository)) throw new Error('protection-busy');
  const expected = deps.repository.listSigners().map(s => ({ ...s }));
  const targets = expected.filter(s => s.kind === 'protected-software');
  const check = () => {
    deps.assertCurrent();
    if (
      input.signal.aborted ||
      deps.hasUnresolvedSubmission() ||
      signerInventory(deps.repository.listSigners()) !== signerInventory(expected)
    )
      throw new Error('protection-context-changed');
  };
  check();
  if (!targets.length || targets.some(s => !s.envelopeJson || s.backupState === 'pending'))
    throw new Error('protection-unavailable');
  rotating.add(deps.repository);
  try {
    const updates: ProtectionUpdate[] = [];
    for (const signer of targets) {
      check();
      const next = await deps.sdk.reprotect({
        envelopeJson: signer.envelopeJson!,
        currentPassphrase: input.currentPassphrase,
        newPassphrase: input.newPassphrase,
        expectedSignerPublicKey: signer.publicKey,
      });
      check();
      if (next.signerPublicKey !== signer.publicKey || !next.envelopeJson || next.envelopeJson === signer.envelopeJson)
        throw new Error('protection-identity-mismatch');
      const verified = await deps.sdk.verifyProtectedSignerPassphrase({
        envelopeJson: next.envelopeJson,
        appPassphrase: input.newPassphrase,
        expectedSignerPublicKey: signer.publicKey,
      });
      check();
      if (verified !== true) throw new Error('protection-verification-failed');
      updates.push({ id: signer.id, protectedSigner: next });
    }
    // Old key-domain authorizations must not outlive changed envelopes. App biometrics are independent.
    if (await deps.sdk.hasSystemAuthDomain()) {
      check();
      if ((await deps.sdk.removeSystemAuthDomain()) !== true) throw new Error('system-auth-cleanup-failed');
    }
    check();
    deps.repository.replaceProtection(expected, updates, deps.now());
  } finally {
    rotating.delete(deps.repository);
  }
}
