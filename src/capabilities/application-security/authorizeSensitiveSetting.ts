import {
  verifyExistingAppPassphrase,
  type ExistingAppPassphraseVerificationDependencies,
} from './verifyExistingAppPassphrase';

// Verification authorizes this invocation only; it never creates a session or reusable auth token.
export async function authorizeSensitiveSetting(
  deps: ExistingAppPassphraseVerificationDependencies,
  passphrase: string,
  signal: AbortSignal,
): Promise<void> {
  const inventory = () =>
    JSON.stringify(
      deps.repository.listSigners().map(s => [s.id, s.publicKey, s.kind, s.envelopeRevision, s.envelopeJson]),
    );
  if (signal.aborted) throw new Error('operation-cancelled');
  const before = inventory();
  const verified = await verifyExistingAppPassphrase(deps, passphrase);
  if (signal.aborted) throw new Error('operation-cancelled');
  if (verified === 0) throw new Error('protected-signer-required');
  if (inventory() !== before) throw new Error('authorization-context-changed');
}
