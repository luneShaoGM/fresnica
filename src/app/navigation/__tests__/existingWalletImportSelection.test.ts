import type { AccountRecord } from '@capabilities/account/types';
import type { FresnicaSdkPort } from '@capabilities/ports/FresnicaSdkPort';
import type { AccountIdentity, ProtectSecretInput } from '@capabilities/ports/fresnicaTypes';
import { importExistingWalletAccount } from '../../../features/accounts/importExistingWalletAccount';
import type { OnboardingProvisioningDependencies } from '../../../features/onboarding/runOnboardingProvisioning';
import { InMemoryAccountSignerRepository } from '../../../platform/persistence/memory/InMemoryAccountSignerRepository';
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

function createPreferences(setError?: Error) {
  let defaultAccountId: string | undefined = 'existing-account';
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
    protectSecret: jest.fn(async (_input: ProtectSecretInput) => ({
      signerPublicKey: 'GIMPORTED',
      envelopeJson: '{imported-envelope}',
    })),
    hasSystemAuthDomain: jest.fn().mockResolvedValue(false),
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

describe('existing-wallet Import default selection', () => {
  it('keeps the old default until durable Import succeeds and selection is persisted', async () => {
    const repository = new InMemoryAccountSignerRepository();
    repository.createAccount(existingAccount());
    const preferences = createPreferences();
    const dependencies = createDependencies(repository);

    const imported = await importExistingWalletAccount(dependencies, {
      kind: 'secret',
      secret: 'SPLAINTEXT',
      appPassphrase: 'a sufficiently long passphrase',
      confirmAppPassphrase: 'a sufficiently long passphrase',
    });

    expect(preferences.read()).toBe('existing-account');
    expect(imported.account.signer.backupState).toBe('not-required');

    selectPersistedAccountAndDefault(
      repository,
      imported.account.account.id,
      dependencies.networkId,
      preferences.store,
    );

    expect(preferences.read()).toBe(imported.account.account.id);
    expect(
      resolvePreferredVisibleAccountId(
        repository.listAccounts(),
        dependencies.networkId,
        preferences.store.getDefaultAccountId(dependencies.networkId),
      ),
    ).toBe(imported.account.account.id);
  });

  it('preserves old current/default authority when default persistence fails after Import', async () => {
    const repository = new InMemoryAccountSignerRepository();
    repository.createAccount(existingAccount());
    const preferences = createPreferences(new Error('default-write-failed'));
    const dependencies = createDependencies(repository);
    const imported = await importExistingWalletAccount(dependencies, {
      kind: 'secret',
      secret: 'SPLAINTEXT',
      appPassphrase: 'a sufficiently long passphrase',
      confirmAppPassphrase: 'a sufficiently long passphrase',
    });

    expect(() =>
      selectPersistedAccountAndDefault(
        repository,
        imported.account.account.id,
        dependencies.networkId,
        preferences.store,
      ),
    ).toThrow('default-write-failed');

    expect(preferences.read()).toBe('existing-account');
    expect(repository.getAccount(imported.account.account.id)).toEqual(imported.account.account);
    expect(repository.getSigner(imported.account.signer.id)).toEqual(imported.account.signer);
    expect(
      resolvePreferredVisibleAccountId(
        repository.listAccounts(),
        dependencies.networkId,
        preferences.store.getDefaultAccountId(dependencies.networkId),
      ),
    ).toBe('existing-account');
  });
});
