import type { AccountRecord } from '@capabilities/account/types';
import type { FresnicaSdkPort } from '@capabilities/ports/FresnicaSdkPort';
import type { AccountIdentity, GenerateMnemonicInput } from '@capabilities/ports/fresnicaTypes';
import { InMemoryAccountSignerRepository } from '../../../platform/persistence/memory/InMemoryAccountSignerRepository';
import { createExistingWalletAccount } from '../../../features/accounts/createExistingWalletAccount';
import { completeMnemonicBackup, resolveOnboardingBootstrap } from '../../../features/onboarding/onboardingBootstrap';
import type { OnboardingProvisioningDependencies } from '../../../features/onboarding/runOnboardingProvisioning';
import type { AccountSelectionPreferenceStore } from '../../accountSelectionPreferences';
import { resolvePreferredVisibleAccountId, selectPersistedAccountAndDefault } from '../accountSelection';

const now = new Date('2026-09-17T00:00:00.000Z');

function existingAccount(): AccountRecord {
  return {
    id: 'existing-account',
    address: 'GEXISTING',
    identityKind: 'classic',
    networkId: 'stellar-testnet',
    label: 'Existing',
    sortOrder: 0,
    hidden: false,
    createdAt: now,
    updatedAt: now,
  };
}

function createPreferences(initialDefault: string, setError?: Error) {
  let defaultAccountId: string | undefined = initialDefault;
  const store: AccountSelectionPreferenceStore = {
    getDefaultAccountId: jest.fn(() => defaultAccountId),
    setDefaultAccountId: jest.fn((_networkId, accountId) => {
      if (setError) throw setError;
      defaultAccountId = accountId;
    }),
    clearDefaultAccountId: jest.fn(() => {
      defaultAccountId = undefined;
    }),
  };
  return { store, read: () => defaultAccountId };
}

function createDependencies(repository: InMemoryAccountSignerRepository): OnboardingProvisioningDependencies {
  const sdk = {
    parseAccount: jest.fn(async (address: string): Promise<AccountIdentity> => ({
      kind: 'classic',
      address,
      publicKey: address,
    })),
    hasSystemAuthDomain: jest.fn().mockResolvedValue(false),
    generateMnemonic: jest.fn(async (input: GenerateMnemonicInput) => ({
      signer: {
        signerPublicKey: 'GCREATED',
        envelopeJson: '{created-envelope}',
      },
      mnemonic: 'alpha beta gamma',
      language: input.language,
      index: input.index,
    })),
  } as unknown as jest.Mocked<FresnicaSdkPort>;

  let nextId = 0;
  return {
    sdk,
    repository,
    createId: kind => `${kind}-${++nextId}`,
    now: () => now,
    networkId: 'stellar-testnet',
  };
}

describe('existing-wallet Create backup/default recovery', () => {
  it('keeps the previous default through pending backup and switches only after confirmation', async () => {
    const repository = new InMemoryAccountSignerRepository();
    repository.createAccount(existingAccount());
    const preferences = createPreferences('existing-account');
    const dependencies = createDependencies(repository);

    const created = await createExistingWalletAccount(dependencies, {
      appPassphrase: 'a sufficiently long passphrase',
      confirmAppPassphrase: 'a sufficiently long passphrase',
    });

    expect(created.account.signer.backupState).toBe('pending');
    expect(preferences.read()).toBe('existing-account');
    expect(resolveOnboardingBootstrap(dependencies)).toEqual({
      kind: 'pending-mnemonic-backup',
      accountId: created.account.account.id,
      signerId: created.account.signer.id,
      signerPublicKey: created.account.signer.publicKey,
    });

    await completeMnemonicBackup(dependencies, created.account.signer.id, () => {
      selectPersistedAccountAndDefault(
        repository,
        created.account.account.id,
        dependencies.networkId,
        preferences.store,
      );
    });

    expect(preferences.read()).toBe(created.account.account.id);
    expect(resolveOnboardingBootstrap(dependencies)).toMatchObject({ kind: 'ready' });
    expect(
      resolvePreferredVisibleAccountId(
        repository.listAccounts(),
        dependencies.networkId,
        preferences.store.getDefaultAccountId(dependencies.networkId),
      ),
    ).toBe(created.account.account.id);
  });

  it('restores pending backup when the default write fails so restart can retry', async () => {
    const repository = new InMemoryAccountSignerRepository();
    repository.createAccount(existingAccount());
    const dependencies = createDependencies(repository);
    const created = await createExistingWalletAccount(dependencies, {
      appPassphrase: 'a sufficiently long passphrase',
      confirmAppPassphrase: 'a sufficiently long passphrase',
    });
    const preferences = createPreferences('existing-account', new Error('default-write-failed'));

    await expect(
      completeMnemonicBackup(dependencies, created.account.signer.id, () => {
        selectPersistedAccountAndDefault(
          repository,
          created.account.account.id,
          dependencies.networkId,
          preferences.store,
        );
      }),
    ).rejects.toThrow('default-write-failed');

    expect(preferences.read()).toBe('existing-account');
    expect(repository.getSigner(created.account.signer.id)?.backupState).toBe('pending');
    expect(resolveOnboardingBootstrap(dependencies)).toEqual({
      kind: 'pending-mnemonic-backup',
      accountId: created.account.account.id,
      signerId: created.account.signer.id,
      signerPublicKey: created.account.signer.publicKey,
    });
  });
});
