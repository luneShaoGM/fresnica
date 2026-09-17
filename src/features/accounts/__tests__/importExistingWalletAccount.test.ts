import type {
  AccountIdentity,
  ProtectMnemonicInput,
  ProtectSecretInput,
} from '../../../capabilities/ports/fresnicaTypes';
import type { FresnicaSdkPort } from '../../../capabilities/ports/FresnicaSdkPort';
import type { AccountRecord } from '../../../capabilities/account/types';
import type { SignerRecord } from '../../../capabilities/signer/types';
import { InMemoryAccountSignerRepository } from '../../../platform/persistence/memory/InMemoryAccountSignerRepository';
import type { OnboardingProvisioningDependencies } from '../../onboarding/runOnboardingProvisioning';
import { importExistingWalletAccount } from '../importExistingWalletAccount';

const now = new Date('2026-09-17T00:00:00.000Z');

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

function watchOnlyAccount(id: string, address: string): AccountRecord {
  return {
    id,
    address,
    identityKind: 'classic',
    networkId: 'stellar-testnet',
    label: 'Existing watch-only',
    sortOrder: 7,
    hidden: false,
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
    protectSecret: jest.fn(async (_input: ProtectSecretInput) => ({
      signerPublicKey: 'GIMPORTED',
      envelopeJson: '{secret-envelope}',
    })),
    protectMnemonic: jest.fn(async (_input: ProtectMnemonicInput) => ({
      signerPublicKey: 'GMNEMONIC',
      envelopeJson: '{mnemonic-envelope}',
    })),
    hasSystemAuthDomain: jest.fn().mockResolvedValue(false),
    initializeSystemAuth: jest.fn().mockResolvedValue(true),
    registerSignerSystemAuth: jest.fn().mockResolvedValue(true),
    removeSystemAuthDomain: jest.fn().mockResolvedValue(true),
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

describe('existing-wallet Import account flow', () => {
  it('establishes the first App Passphrase and persists imported secret as not-required backup', async () => {
    const { dependencies, repository, sdk } = createDependencies();
    const result = await importExistingWalletAccount(dependencies, {
      kind: 'secret',
      secret: 'SPLAINTEXT',
      appPassphrase: 'a sufficiently long passphrase',
      confirmAppPassphrase: 'a sufficiently long passphrase',
      label: 'Imported',
    });

    expect(sdk.verifyProtectedSignerPassphrase).not.toHaveBeenCalled();
    expect(result.account.account.address).toBe('GIMPORTED');
    expect(result.account.signer.backupState).toBe('not-required');
    expect(repository.isWatchOnly(result.account.account.id)).toBe(false);
    expect(result.systemAuthRegistration).toBe('not-configured');
  });

  it('rejects new App Passphrase mismatch before Native protection or persistence', async () => {
    const { dependencies, repository, sdk } = createDependencies();
    await expect(
      importExistingWalletAccount(dependencies, {
        kind: 'secret',
        secret: 'SPLAINTEXT',
        appPassphrase: 'a sufficiently long passphrase',
        confirmAppPassphrase: 'a different long passphrase',
      }),
    ).rejects.toThrow('app-passphrase-confirmation-mismatch');

    expect(sdk.protectSecret).not.toHaveBeenCalled();
    expect(sdk.hasSystemAuthDomain).not.toHaveBeenCalled();
    expect(repository.listAccounts()).toEqual([]);
    expect(repository.listSigners()).toEqual([]);
  });

  it('verifies every existing protected signer before protecting imported material', async () => {
    const { dependencies, repository, sdk } = createDependencies();
    repository.createSigner(protectedSigner('one'));
    repository.createSigner(protectedSigner('two'));

    await importExistingWalletAccount(dependencies, {
      kind: 'secret',
      secret: 'SPLAINTEXT',
      appPassphrase: 'current app passphrase',
    });

    expect(sdk.verifyProtectedSignerPassphrase).toHaveBeenCalledTimes(2);
    expect(sdk.protectSecret).toHaveBeenCalledTimes(1);
    expect(Math.max(...sdk.verifyProtectedSignerPassphrase.mock.invocationCallOrder)).toBeLessThan(
      sdk.protectSecret.mock.invocationCallOrder[0],
    );
  });

  it('keeps wallet state unchanged when current App Passphrase verification fails', async () => {
    const { dependencies, repository, sdk } = createDependencies();
    const existing = protectedSigner('existing');
    repository.createSigner(existing);
    sdk.verifyProtectedSignerPassphrase.mockRejectedValueOnce(
      Object.assign(new Error('invalid-passcode'), { code: 'invalid-passcode' }),
    );

    await expect(
      importExistingWalletAccount(dependencies, {
        kind: 'secret',
        secret: 'SPLAINTEXT',
        appPassphrase: 'wrong passphrase',
      }),
    ).rejects.toMatchObject({ code: 'invalid-passcode' });

    expect(sdk.protectSecret).not.toHaveBeenCalled();
    expect(sdk.hasSystemAuthDomain).not.toHaveBeenCalled();
    expect(repository.listAccounts()).toEqual([]);
    expect(repository.listSigners()).toEqual([existing]);
  });

  it('forwards mnemonic language, passphrase and derivation index unchanged', async () => {
    const { dependencies, sdk } = createDependencies();
    const result = await importExistingWalletAccount(dependencies, {
      kind: 'mnemonic',
      mnemonic: 'one two three',
      mnemonicPassphrase: 'bip39 extension',
      index: 9,
      language: 'english',
      appPassphrase: 'a sufficiently long passphrase',
      confirmAppPassphrase: 'a sufficiently long passphrase',
    });

    expect(sdk.protectMnemonic).toHaveBeenCalledWith({
      mnemonic: 'one two three',
      mnemonicPassphrase: 'bip39 extension',
      index: 9,
      language: 'english',
      appPassphrase: 'a sufficiently long passphrase',
    });
    expect(result.account.signer.backupState).toBe('not-required');
    expect(JSON.stringify(result)).not.toContain('one two three');
    expect(JSON.stringify(result)).not.toContain('bip39 extension');
  });

  it('upgrades a visible same-network watch-only account without replacing its Account record', async () => {
    const { dependencies, repository } = createDependencies();
    const existing = watchOnlyAccount('watch-only', 'GIMPORTED');
    repository.createAccount(existing);

    const result = await importExistingWalletAccount(dependencies, {
      kind: 'secret',
      secret: 'SPLAINTEXT',
      appPassphrase: 'a sufficiently long passphrase',
      confirmAppPassphrase: 'a sufficiently long passphrase',
      label: 'Ignored label',
    });

    expect(result.account.account).toEqual(existing);
    expect(repository.listAccounts()).toEqual([existing]);
    expect(repository.listSignersForAccount(existing.id)).toEqual([result.account.signer]);
  });

  it('rejects a same-network account that already has signing authority without duplicate persistence', async () => {
    const { dependencies, repository } = createDependencies();
    const existing = watchOnlyAccount('existing', 'GIMPORTED');
    repository.createAccountWithSigner({
      account: existing,
      signer: protectedSigner('existing-signer'),
      attachedAt: now,
    });

    await expect(
      importExistingWalletAccount(dependencies, {
        kind: 'secret',
        secret: 'SPLAINTEXT',
        appPassphrase: 'current app passphrase',
      }),
    ).rejects.toThrow('account-already-exists');

    expect(repository.listAccounts()).toEqual([existing]);
    expect(repository.listSigners()).toHaveLength(1);
  });

  it('registers System Auth only after imported Account+Signer persistence', async () => {
    const { dependencies, repository, sdk } = createDependencies();
    sdk.hasSystemAuthDomain.mockImplementationOnce(async () => {
      expect(repository.listAccounts().map(account => account.address)).toContain('GIMPORTED');
      expect(repository.listSigners().map(signer => signer.publicKey)).toContain('GIMPORTED');
      return true;
    });

    const result = await importExistingWalletAccount(dependencies, {
      kind: 'secret',
      secret: 'SPLAINTEXT',
      appPassphrase: 'a sufficiently long passphrase',
      confirmAppPassphrase: 'a sufficiently long passphrase',
    });

    expect(result.systemAuthRegistration).toBe('registered');
    expect(sdk.registerSignerSystemAuth).toHaveBeenCalledTimes(1);
    expect(sdk.initializeSystemAuth).not.toHaveBeenCalled();
  });

  it('preserves imported state and reports repair-required when System Auth registration fails', async () => {
    const { dependencies, repository, sdk } = createDependencies();
    sdk.hasSystemAuthDomain.mockResolvedValueOnce(true);
    sdk.registerSignerSystemAuth.mockRejectedValueOnce(new Error('system-auth-registration-failed'));

    const result = await importExistingWalletAccount(dependencies, {
      kind: 'secret',
      secret: 'SPLAINTEXT',
      appPassphrase: 'a sufficiently long passphrase',
      confirmAppPassphrase: 'a sufficiently long passphrase',
    });

    expect(result.systemAuthRegistration).toBe('repair-required');
    expect(repository.getAccount(result.account.account.id)).toEqual(result.account.account);
    expect(repository.getSigner(result.account.signer.id)).toEqual(result.account.signer);
  });

  it('leaves no product writes when Native recovery protection rejects invalid material', async () => {
    const { dependencies, repository, sdk } = createDependencies();
    sdk.protectSecret.mockRejectedValueOnce(Object.assign(new Error('invalid-input'), { code: 'invalid-input' }));

    await expect(
      importExistingWalletAccount(dependencies, {
        kind: 'secret',
        secret: 'INVALID',
        appPassphrase: 'a sufficiently long passphrase',
        confirmAppPassphrase: 'a sufficiently long passphrase',
      }),
    ).rejects.toMatchObject({ code: 'invalid-input' });

    expect(repository.listAccounts()).toEqual([]);
    expect(repository.listSigners()).toEqual([]);
    expect(sdk.hasSystemAuthDomain).not.toHaveBeenCalled();
  });
});
