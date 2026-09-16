import type { AccountSignerRepository } from '../account/AccountSignerRepository';
import type { FresnicaSdkPort } from '../ports/FresnicaSdkPort';

export type ExistingAppPassphraseVerificationDependencies = Readonly<{
  sdk: FresnicaSdkPort;
  repository: AccountSignerRepository;
}>;

type VerificationTarget = Readonly<{
  signerPublicKey: string;
  envelopeJson: string;
}>;

export function requiresExistingAppPassphrase(repository: AccountSignerRepository): boolean {
  return repository.listSigners().some(signer => signer.kind === 'protected-software');
}

export async function verifyExistingAppPassphrase(
  dependencies: ExistingAppPassphraseVerificationDependencies,
  appPassphrase: string,
): Promise<number> {
  const targets = protectedSignerVerificationTargets(dependencies.repository);

  let firstFailure: unknown;

  for (const target of targets) {
    try {
      const verified = await dependencies.sdk.verifyProtectedSignerPassphrase({
        envelopeJson: target.envelopeJson,
        appPassphrase,
        expectedSignerPublicKey: target.signerPublicKey,
      });
      if (!verified && firstFailure === undefined) {
        firstFailure = new Error('invalid-passcode');
      }
    } catch (error) {
      if (firstFailure === undefined) {
        firstFailure = error;
      }
    }
  }

  if (firstFailure !== undefined) {
    throw firstFailure;
  }

  return targets.length;
}

function protectedSignerVerificationTargets(repository: AccountSignerRepository): VerificationTarget[] {
  const seen = new Set<string>();
  const targets: VerificationTarget[] = [];

  for (const signer of repository.listSigners()) {
    if (signer.kind !== 'protected-software') {
      continue;
    }

    if (!signer.envelopeJson?.trim()) {
      throw new Error('protected-signer-envelope-missing');
    }

    const key = `${signer.publicKey}\u0000${signer.envelopeJson}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    targets.push({
      signerPublicKey: signer.publicKey,
      envelopeJson: signer.envelopeJson,
    });
  }

  return targets;
}
