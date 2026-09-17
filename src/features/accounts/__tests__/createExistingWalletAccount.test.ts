import type { FresnicaSdkPort } from '../../../capabilities/ports/FresnicaSdkPort';
import type { AccountIdentity, GenerateMnemonicInput } from '../../../capabilities/ports/fresnicaTypes';
import type { AccountRecord } from '../../../capabilities/account/types';
import type { SignerRecord } from '../../../capabilities/signer/types';
import { InMemoryAccountSignerRepository } from '../../../platform/persistence/memory/InMemoryAccountSignerRepository';
import type { OnboardingProvisioningDependencies } from '../../onboarding/runOnboardingProvisioning';
import { createExistingWalletAccount } from '../createExistingWalletAccount';

const now = new Date('2026-09-16T00:00:00.000Z');

function protectedSigner(id: string): SignerRecord {
  return {
    id,
    publicKey: `G${id.toUpperCase()}`,
    kind: 'protected-software',
    envelopeJson: `{${id}-envelope}`,
    recoveryKind: 'mnemonic',
    backupState: 'confirmed',
    createdAt: now,
    updatedAt: now,
  };
}

function createDependencies() {
  const repository = new InMemoryAccountSignerRepository();
  const sdk = {
    parseAccount: jest.fn(async (address: string): Promise<AccountIdentity> => ({
      kind: 'classic',
      address,
      publicKey: address,
    })),
    verifyProtectedSignerPassphrase: jest.fn().mockResolvedValue(true),
    hasSystemAuthDomain: jest.fn().mockResolvedValue(false),
    initializeSystemAuth: jest.fn().mockResolvedValue(true),
    registerSignerSystemAuth: jest.fn().mockResolvedValue(true),
    removeSystemAuthDomain: jest.fn().mockResolvedValue(true),
    generateMnemonic: jest.fn(async (input: GenerateMnemonicInput) => ({
      signer: {
        signerPublicKey: 'GGENERATED',
        envelopeJson: '{generated-envelope}',
      },
      mnemonic: 'alpha beta gamma',
      language: input.language,
      index: input.index,
    })),
  } as unknown as jest.Mocked<FresnicaSdkPort>;

  let nextId = 0;
  const dependencies: OnboardingProvisioningDependencies = {
    sdk,
    repository,
    createId: kind => `${kind}-${++nextId}`,
    now: () => now,
    networkId: 'stellar-testnet',
  };

  return { dependencies, repository, sdk };
}

function expectNoGeneratedWrites(repository: InMemoryAccountSignerRepository, sdk: jest.Mocked<FresnicaSdkPort>) {
  expect(sdk.generateMnemonic).not.toHaveBeenCalled();
  expect(repository.listAccounts()).toEqual([]);
  expect(repository.listSigners()).toEqual([]);
}

describe('existing-wallet Create account flow', () => {
  it('establishes the first App Passphrase when no protected signer exists', async () => {
    const { dependencies, repository, sdk } = createDependencies();

    const result = await createExistingWalletAccount(dependencies, {
      appPassphrase: 'a sufficiently long passphrase',
      confirmAppPassphrase: 'a sufficiently long passphrase',
      label: 'Created',
    });

    expect(sdk.verifyProtectedSignerPassphrase).not.toHaveBeenCalled();
    expect(result.account.account.address).toBe('GGENERATED');
    expect(result.account.signer.backupState).toBe('pending');
    expect(repository.isWatchOnly(result.account.account.id)).toBe(false);
    expect(result.systemAuthRegistration).toBe('not-configured');
  });

  it('rejects a new App Passphrase mismatch before Native or repository work', async () => {
    const { dependencies, repository, sdk } = createDependencies();

    await expect(
      createExistingWalletAccount(dependencies, {
        appPassphrase: 'a sufficiently long passphrase',
        confirmAppPassphrase: 'a different long passphrase',
      }),
    ).rejects.toThrow('app-passphrase-confirmation-mismatch');

    expect(sdk.hasSystemAuthDomain).not.toHaveBeenCalled();
    expectNoGeneratedWrites(repository, sdk);
  });

  it('verifies every existing protected signer before mnemonic generation', async () => {
    const { dependencies, repository, sdk } = createDependencies();
    repository.createSigner(protectedSigner('one'));
    repository.createSigner(protectedSigner('two'));

    await createExistingWalletAccount(dependencies, {
      appPassphrase: 'current app passphrase',
    });

    expect(sdk.verifyProtectedSignerPassphrase).toHaveBeenCalledTimes(2);
    expect(sdk.generateMnemonic).toHaveBeenCalledTimes(1);
    const verificationOrder = sdk.verifyProtectedSignerPassphrase.mock.invocationCallOrder;
    expect(Math.max(...verificationOrder)).toBeLessThan(sdk.generateMnemonic.mock.invocationCallOrder[0]);
  });

  it('keeps the wallet unchanged when current App Passphrase verification fails', async () => {
    const { dependencies, repository, sdk } = createDependencies();
    const existing = protectedSigner('existing');
    repository.createSigner(existing);
    sdk.verifyProtectedSignerPassphrase.mockRejectedValueOnce(
      Object.assign(new Error('invalid-passcode'), { code: 'invalid-passcode' }),
    );

    await expect(
      createExistingWalletAccount(dependencies, { appPassphrase: 'wrong passphrase' }),
    ).rejects.toMatchObject({ code: 'invalid-passcode' });

    expect(sdk.hasSystemAuthDomain).not.toHaveBeenCalled();
    expect(sdk.generateMnemonic).not.toHaveBeenCalled();
    expect(repository.listAccounts()).toEqual([]);
    expect(repository.listSigners()).toEqual([existing]);
  });

  it('leaves no orphan signer when generated identity collides with an existing account', async () => {
    const { dependencies, repository, sdk } = createDependencies();
    const existing: AccountRecord = {
      id: 'existing-account',
      address: 'GGENERATED',
      identityKind: 'classic',
      networkId: 'stellar-testnet',
      label: 'Existing',
      sortOrder: 0,
      hidden: false,
      createdAt: now,
      updatedAt: now,
    };
    repository.createAccount(existing);
    sdk.hasSystemAuthDomain.mockResolvedValueOnce(true);

    await expect(
      createExistingWalletAccount(dependencies, {
        appPassphrase: 'a sufficiently long passphrase',
        confirmAppPassphrase: 'a sufficiently long passphrase',
      }),
    ).rejects.toThrow('duplicate-account-identity');

    expect(repository.listAccounts()).toEqual([existing]);
    expect(repository.listSigners()).toEqual([]);
    expect(sdk.registerSignerSystemAuth).not.toHaveBeenCalled();
  });

  it('keeps the created account and reports repair-required when System Auth status lookup fails', async () => {
    const { dependencies, repository, sdk } = createDependencies();
    sdk.hasSystemAuthDomain.mockRejectedValueOnce(new Error('system-auth-status-failed'));

    const result = await createExistingWalletAccount(dependencies, {
      appPassphrase: 'a sufficiently long passphrase',
      confirmAppPassphrase: 'a sufficiently long passphrase',
    });

    expect(result.systemAuthRegistration).toBe('repair-required');
    expect(repository.getAccount(result.account.account.id)).toEqual(result.account.account);
    expect(repository.getSigner(result.account.signer.id)).toEqual(result.account.signer);
  });

  it('registers only the new signer after durable Account+Signer persistence', async () => {
    const { dependencies, repository, sdk } = createDependencies();
    sdk.hasSystemAuthDomain.mockImplementationOnce(async () => {
      expect(repository.listAccounts().map(account => account.address)).toContain('GGENERATED');
      expect(repository.listSigners().map(signer => signer.publicKey)).toContain('GGENERATED');
      return true;
    });
    sdk.registerSignerSystemAuth.mockImplementationOnce(async input => {
      expect(input.expectedSignerPublicKey).toBe('GGENERATED');
      return true;
    });

    const result = await createExistingWalletAccount(dependencies, {
      appPassphrase: 'a sufficiently long passphrase',
      confirmAppPassphrase: 'a sufficiently long passphrase',
    });

    expect(result.systemAuthRegistration).toBe('registered');
    expect(sdk.registerSignerSystemAuth).toHaveBeenCalledTimes(1);
    expect(sdk.initializeSystemAuth).not.toHaveBeenCalled();
    expect(sdk.removeSystemAuthDomain).not.toHaveBeenCalled();
  });

  it('keeps the created account and reports repair-required when System Auth registration fails', async () => {
    const { dependencies, repository, sdk } = createDependencies();
    sdk.hasSystemAuthDomain.mockResolvedValueOnce(true);
    sdk.registerSignerSystemAuth.mockRejectedValueOnce(new Error('system-auth-registration-failed'));

    const result = await createExistingWalletAccount(dependencies, {
      appPassphrase: 'a sufficiently long passphrase',
      confirmAppPassphrase: 'a sufficiently long passphrase',
    });

    expect(result.systemAuthRegistration).toBe('repair-required');
    expect(repository.getAccount(result.account.account.id)).toEqual(result.account.account);
    expect(repository.getSigner(result.account.signer.id)).toEqual(result.account.signer);
    expect(result.account.signer.backupState).toBe('pending');
  });

  it('treats a false System Auth registration result as repair-required', async () => {
    const { dependencies, repository, sdk } = createDependencies();
    sdk.hasSystemAuthDomain.mockResolvedValueOnce(true);
    sdk.registerSignerSystemAuth.mockResolvedValueOnce(false);

    const result = await createExistingWalletAccount(dependencies, {
      appPassphrase: 'a sufficiently long passphrase',
      confirmAppPassphrase: 'a sufficiently long passphrase',
    });

    expect(result.systemAuthRegistration).toBe('repair-required');
    expect(repository.isWatchOnly(result.account.account.id)).toBe(false);
  });
});
