import type { FresnicaSdkPort } from '../../ports/FresnicaSdkPort';
import { InMemoryAccountSignerRepository } from '../../../platform/persistence/memory/InMemoryAccountSignerRepository';
import type { SignerRecord } from '../../signer/types';
import { requiresExistingAppPassphrase, verifyExistingAppPassphrase } from '../verifyExistingAppPassphrase';

const now = new Date('2026-09-16T00:00:00.000Z');

function protectedSigner(
  id: string,
  publicKey = `G${id}`,
  envelopeJson: string | undefined = `{${id}-envelope}`,
): SignerRecord {
  return {
    id,
    publicKey,
    kind: 'protected-software',
    ...(envelopeJson === undefined ? {} : { envelopeJson }),
    createdAt: now,
    updatedAt: now,
  };
}

function createDependencies() {
  const repository = new InMemoryAccountSignerRepository();
  const sdk = {
    verifyProtectedSignerPassphrase: jest.fn().mockResolvedValue(true),
  } as unknown as jest.Mocked<FresnicaSdkPort>;
  return { repository, sdk, dependencies: { repository, sdk } };
}

describe('existing App Passphrase verification', () => {
  it('does not require verification when no protected software signer exists', async () => {
    const { repository, sdk, dependencies } = createDependencies();

    expect(requiresExistingAppPassphrase(repository)).toBe(false);
    await expect(verifyExistingAppPassphrase(dependencies, 'unused')).resolves.toBe(0);
    expect(sdk.verifyProtectedSignerPassphrase).not.toHaveBeenCalled();
  });

  it('verifies every unique public-key/envelope pair', async () => {
    const { repository, sdk, dependencies } = createDependencies();
    repository.createSigner(protectedSigner('one', 'GONE', '{shared-envelope}'));
    repository.createSigner(protectedSigner('duplicate', 'GONE', '{shared-envelope}'));
    repository.createSigner(protectedSigner('identity-mismatch-target', 'GTWO', '{shared-envelope}'));

    expect(requiresExistingAppPassphrase(repository)).toBe(true);
    await expect(verifyExistingAppPassphrase(dependencies, 'current passphrase')).resolves.toBe(2);

    expect(sdk.verifyProtectedSignerPassphrase).toHaveBeenCalledTimes(2);
    expect(sdk.verifyProtectedSignerPassphrase).toHaveBeenNthCalledWith(1, {
      envelopeJson: '{shared-envelope}',
      appPassphrase: 'current passphrase',
      expectedSignerPublicKey: 'GONE',
    });
    expect(sdk.verifyProtectedSignerPassphrase).toHaveBeenNthCalledWith(2, {
      envelopeJson: '{shared-envelope}',
      appPassphrase: 'current passphrase',
      expectedSignerPublicKey: 'GTWO',
    });
  });

  it('fails closed when a protected signer is missing its envelope', async () => {
    const { repository, sdk, dependencies } = createDependencies();
    repository.createSigner(protectedSigner('broken', 'GBROKEN', ''));

    await expect(verifyExistingAppPassphrase(dependencies, 'current passphrase')).rejects.toThrow(
      'protected-signer-envelope-missing',
    );
    expect(sdk.verifyProtectedSignerPassphrase).not.toHaveBeenCalled();
  });

  it('checks every target before failing when any target rejects the passphrase', async () => {
    const { repository, sdk, dependencies } = createDependencies();
    repository.createSigner(protectedSigner('one', 'GONE'));
    repository.createSigner(protectedSigner('two', 'GTWO'));
    sdk.verifyProtectedSignerPassphrase.mockResolvedValueOnce(false);

    await expect(verifyExistingAppPassphrase(dependencies, 'wrong passphrase')).rejects.toThrow('invalid-passcode');
    expect(sdk.verifyProtectedSignerPassphrase).toHaveBeenCalledTimes(2);
  });

  it('preserves canonical Native verification errors', async () => {
    const { repository, sdk, dependencies } = createDependencies();
    repository.createSigner(protectedSigner('one', 'GONE'));
    sdk.verifyProtectedSignerPassphrase.mockRejectedValueOnce(
      Object.assign(new Error('identity-mismatch'), { code: 'identity-mismatch' }),
    );

    await expect(verifyExistingAppPassphrase(dependencies, 'current passphrase')).rejects.toMatchObject({
      code: 'identity-mismatch',
    });
  });
});
