import type { AccountIdentity, DeriveMnemonicSignerInput } from '../../../capabilities/ports/fresnicaTypes';
import type { FresnicaSdkPort } from '../../../capabilities/ports/FresnicaSdkPort';
import type { AccountRecord } from '../../../capabilities/account/types';
import type { SignerRecord } from '../../../capabilities/signer/types';
import { InMemoryAccountSignerRepository } from '../../../platform/persistence/memory/InMemoryAccountSignerRepository';
import type { OnboardingProvisioningDependencies } from '../../onboarding/runOnboardingProvisioning';
import {
  deriveExistingWalletAccount,
  listExistingWalletHdSourceCandidates,
  stellarHdPath,
} from '../deriveExistingWalletAccount';

const now = new Date('2026-09-17T03:30:00.000Z');

function account(
  id: string,
  address: string,
  options: Partial<Pick<AccountRecord, 'networkId' | 'label' | 'sortOrder' | 'hidden'>> = {},
): AccountRecord {
  return {
    id,
    address,
    identityKind: 'classic',
    networkId: options.networkId ?? 'stellar-testnet',
    label: options.label ?? id,
    sortOrder: options.sortOrder ?? 0,
    hidden: options.hidden ?? false,
    createdAt: now,
    updatedAt: now,
  };
}

function protectedSigner(
  id: string,
  options: Partial<Pick<SignerRecord, 'publicKey' | 'recoveryKind' | 'backupState' | 'envelopeJson'>> = {},
): SignerRecord {
  return {
    id,
    publicKey: options.publicKey ?? `G${id.toUpperCase()}`,
    kind: 'protected-software',
    envelopeJson: options.envelopeJson ?? `{${id}-envelope}`,
    recoveryKind: options.recoveryKind ?? 'mnemonic',
    backupState: options.backupState ?? 'confirmed',
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
    deriveMnemonicSigner: jest.fn(async (_input: DeriveMnemonicSignerInput) => ({
      signerPublicKey: 'GDERIVED',
      envelopeJson: '{derived-envelope}',
    })),
    reveal: jest.fn(),
    hasSystemAuthDomain: jest.fn().mockResolvedValue(false),
    registerSignerSystemAuth: jest.fn().mockResolvedValue(true),
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

function attachSource(
  dependencies: OnboardingProvisioningDependencies,
  source: SignerRecord,
  sourceAccount: AccountRecord = account('source-account', source.publicKey, { label: 'Primary source' }),
) {
  dependencies.repository.createAccountWithSigner({
    account: sourceAccount,
    signer: source,
    attachedAt: now,
  });
  return sourceAccount;
}

describe('existing-wallet HD additional-account flow', () => {
  it('lists only unique eligible mnemonic-backed sources reachable from visible current-network accounts', () => {
    const { dependencies, repository } = createDependencies();
    const eligible = protectedSigner('eligible');
    const imported = protectedSigner('imported', { backupState: 'not-required' });
    const secret = protectedSigner('secret', { recoveryKind: 'secret' });
    const pending = protectedSigner('pending', { backupState: 'pending' });
    const missingEnvelope = protectedSigner('missing-envelope', { envelopeJson: '' });
    const hiddenOnly = protectedSigner('hidden-only');
    const otherNetwork = protectedSigner('other-network');

    attachSource(dependencies, eligible, account('a', eligible.publicKey, { label: 'A', sortOrder: 1 }));
    repository.createAccount(account('b', 'GB', { label: 'B', sortOrder: 2 }));
    repository.attachSigner('b', eligible.id, now);
    attachSource(dependencies, imported, account('imported-account', imported.publicKey, { sortOrder: 3 }));
    attachSource(dependencies, secret, account('secret-account', secret.publicKey, { sortOrder: 4 }));
    attachSource(dependencies, pending, account('pending-account', pending.publicKey, { sortOrder: 5 }));
    attachSource(
      dependencies,
      missingEnvelope,
      account('missing-envelope-account', missingEnvelope.publicKey, { sortOrder: 6 }),
    );
    attachSource(
      dependencies,
      hiddenOnly,
      account('hidden-account', hiddenOnly.publicKey, { sortOrder: 7, hidden: true }),
    );
    attachSource(
      dependencies,
      otherNetwork,
      account('other-network-account', otherNetwork.publicKey, {
        networkId: 'stellar-mainnet',
        sortOrder: 8,
      }),
    );

    expect(listExistingWalletHdSourceCandidates(dependencies)).toEqual([
      {
        signerId: eligible.id,
        signerPublicKey: eligible.publicKey,
        backupState: 'confirmed',
        accountLabel: 'A',
      },
      {
        signerId: imported.id,
        signerPublicKey: imported.publicKey,
        backupState: 'not-required',
        accountLabel: 'imported-account',
      },
    ]);
  });

  it('verifies every protected target before deriving the exact selected source and index without Reveal', async () => {
    const { dependencies, repository, sdk } = createDependencies();
    const source = protectedSigner('source');
    const other = protectedSigner('other');
    attachSource(dependencies, source);
    repository.createSigner(other);

    const result = await deriveExistingWalletAccount(dependencies, {
      sourceSignerId: source.id,
      index: 7,
      appPassphrase: 'current app passphrase',
      label: 'HD 7',
    });

    expect(sdk.verifyProtectedSignerPassphrase).toHaveBeenCalledTimes(2);
    expect(Math.max(...sdk.verifyProtectedSignerPassphrase.mock.invocationCallOrder)).toBeLessThan(
      sdk.deriveMnemonicSigner.mock.invocationCallOrder[0],
    );
    expect(sdk.deriveMnemonicSigner).toHaveBeenCalledWith({
      sourceEnvelopeJson: source.envelopeJson,
      appPassphrase: 'current app passphrase',
      expectedSourceSignerPublicKey: source.publicKey,
      index: 7,
    });
    expect(sdk.reveal).not.toHaveBeenCalled();
    expect(result.account.account.address).toBe('GDERIVED');
    expect(result.account.signer.recoveryKind).toBe('mnemonic');
    expect(result.account.signer.backupState).toBe('confirmed');
  });

  it('inherits not-required recovery state from an imported mnemonic source', async () => {
    const { dependencies } = createDependencies();
    const source = protectedSigner('imported-source', { backupState: 'not-required' });
    attachSource(dependencies, source);

    const result = await deriveExistingWalletAccount(dependencies, {
      sourceSignerId: source.id,
      index: 2,
      appPassphrase: 'current app passphrase',
    });

    expect(result.account.signer.backupState).toBe('not-required');
  });

  it('fails before derivation and persistence when current App Passphrase verification fails', async () => {
    const { dependencies, repository, sdk } = createDependencies();
    const source = protectedSigner('source');
    attachSource(dependencies, source);
    sdk.verifyProtectedSignerPassphrase.mockRejectedValueOnce(
      Object.assign(new Error('invalid-passcode'), { code: 'invalid-passcode' }),
    );

    await expect(
      deriveExistingWalletAccount(dependencies, {
        sourceSignerId: source.id,
        index: 1,
        appPassphrase: 'wrong passphrase',
      }),
    ).rejects.toMatchObject({ code: 'invalid-passcode' });

    expect(sdk.deriveMnemonicSigner).not.toHaveBeenCalled();
    expect(sdk.hasSystemAuthDomain).not.toHaveBeenCalled();
    expect(repository.listAccounts()).toHaveLength(1);
    expect(repository.listSigners()).toEqual([source]);
  });

  it.each([-1, 1.5, Number.NaN, 2147483648])(
    'rejects invalid index %p before verification or derivation',
    async invalidIndex => {
      const { dependencies, sdk } = createDependencies();
      const source = protectedSigner('source');
      attachSource(dependencies, source);

      await expect(
        deriveExistingWalletAccount(dependencies, {
          sourceSignerId: source.id,
          index: invalidIndex,
          appPassphrase: 'current app passphrase',
        }),
      ).rejects.toThrow('invalid-derivation-index');

      expect(sdk.verifyProtectedSignerPassphrase).not.toHaveBeenCalled();
      expect(sdk.deriveMnemonicSigner).not.toHaveBeenCalled();
    },
  );

  it('rejects a secret-backed or pending source before passphrase verification', async () => {
    const { dependencies, sdk } = createDependencies();
    const secret = protectedSigner('secret-source', { recoveryKind: 'secret' });
    const pending = protectedSigner('pending-source', { backupState: 'pending' });
    attachSource(dependencies, secret, account('secret-account', secret.publicKey));
    attachSource(dependencies, pending, account('pending-account', pending.publicKey, { sortOrder: 1 }));

    await expect(
      deriveExistingWalletAccount(dependencies, {
        sourceSignerId: secret.id,
        index: 1,
        appPassphrase: 'current app passphrase',
      }),
    ).rejects.toThrow('hd-source-not-eligible');
    await expect(
      deriveExistingWalletAccount(dependencies, {
        sourceSignerId: pending.id,
        index: 1,
        appPassphrase: 'current app passphrase',
      }),
    ).rejects.toThrow('hd-source-not-eligible');

    expect(sdk.verifyProtectedSignerPassphrase).not.toHaveBeenCalled();
    expect(sdk.deriveMnemonicSigner).not.toHaveBeenCalled();
  });

  it('upgrades a visible same-network watch-only derived identity in place', async () => {
    const { dependencies, repository } = createDependencies();
    const source = protectedSigner('source');
    attachSource(dependencies, source);
    const watchOnly = account('watch-derived', 'GDERIVED', { label: 'Watch derived', sortOrder: 5 });
    repository.createAccount(watchOnly);

    const result = await deriveExistingWalletAccount(dependencies, {
      sourceSignerId: source.id,
      index: 4,
      appPassphrase: 'current app passphrase',
      label: 'Ignored label',
    });

    expect(result.account.account).toEqual(watchOnly);
    expect(repository.listAccounts()).toContainEqual(watchOnly);
    expect(repository.listSignersForAccount(watchOnly.id)).toEqual([result.account.signer]);
  });

  it('rejects a derived identity that already has signing authority without duplicate persistence', async () => {
    const { dependencies, repository } = createDependencies();
    const source = protectedSigner('source');
    attachSource(dependencies, source);
    const duplicateAccount = account('duplicate', 'GDERIVED', { sortOrder: 3 });
    const duplicateSigner = protectedSigner('duplicate-signer', { publicKey: 'GDERIVED' });
    repository.createAccountWithSigner({
      account: duplicateAccount,
      signer: duplicateSigner,
      attachedAt: now,
    });

    await expect(
      deriveExistingWalletAccount(dependencies, {
        sourceSignerId: source.id,
        index: 1,
        appPassphrase: 'current app passphrase',
      }),
    ).rejects.toThrow('account-already-exists');

    expect(repository.listAccounts()).toHaveLength(2);
    expect(repository.listSigners()).toHaveLength(2);
  });

  it('registers System Auth only after durable derivation and preserves state on repair-required', async () => {
    const { dependencies, repository, sdk } = createDependencies();
    const source = protectedSigner('source');
    attachSource(dependencies, source);
    sdk.hasSystemAuthDomain.mockImplementationOnce(async () => {
      expect(repository.listAccounts().map(item => item.address)).toContain('GDERIVED');
      expect(repository.listSigners().map(item => item.publicKey)).toContain('GDERIVED');
      return true;
    });
    sdk.registerSignerSystemAuth.mockRejectedValueOnce(new Error('system-auth-registration-failed'));

    const result = await deriveExistingWalletAccount(dependencies, {
      sourceSignerId: source.id,
      index: 3,
      appPassphrase: 'current app passphrase',
    });

    expect(result.systemAuthRegistration).toBe('repair-required');
    expect(repository.getAccount(result.account.account.id)).toEqual(result.account.account);
    expect(repository.getSigner(result.account.signer.id)).toEqual(result.account.signer);
  });

  it('formats the exact SEP-5 path for the confirmed explicit index', () => {
    expect(stellarHdPath(0)).toBe("m/44'/148'/0'");
    expect(stellarHdPath(2147483647)).toBe("m/44'/148'/2147483647'");
  });
});
