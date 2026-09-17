import type { AccountRecord } from '@capabilities/account/types';
import type { FresnicaSdkPort } from '@capabilities/ports/FresnicaSdkPort';
import type { AccountIdentity, DeriveMnemonicSignerInput } from '@capabilities/ports/fresnicaTypes';
import type { SignerRecord } from '@capabilities/signer/types';
import { deriveExistingWalletAccount } from '../../../features/accounts/deriveExistingWalletAccount';
import type { OnboardingProvisioningDependencies } from '../../../features/onboarding/runOnboardingProvisioning';
import { InMemoryAccountSignerRepository } from '../../../platform/persistence/memory/InMemoryAccountSignerRepository';
import type { AccountSelectionPreferenceStore } from '../../accountSelectionPreferences';
import { resolvePreferredVisibleAccountId, selectPersistedAccountAndDefault } from '../accountSelection';

const now = new Date('2026-09-17T03:45:00.000Z');

function sourceAccount(): AccountRecord {
  return {
    id: 'source-account',
    address: 'GSOURCE',
    identityKind: 'classic',
    networkId: 'stellar-testnet',
    label: 'Source',
    sortOrder: 0,
    hidden: false,
    createdAt: now,
    updatedAt: now,
  };
}
function sourceSigner(): SignerRecord {
  return {
    id: 'source-signer',
    publicKey: 'GSOURCE',
    kind: 'protected-software',
    envelopeJson: '{source-envelope}',
    recoveryKind: 'mnemonic',
    backupState: 'confirmed',
    createdAt: now,
    updatedAt: now,
  };
}

function createPreferences(setError?: Error) {
  let defaultAccountId: string | undefined = 'source-account';
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
    verifyProtectedSignerPassphrase: jest.fn().mockResolvedValue(true),
    deriveMnemonicSigner: jest.fn(async (_input: DeriveMnemonicSignerInput) => ({
      signerPublicKey: 'GDERIVED',
      envelopeJson: '{derived-envelope}',
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

function seedSource(repository: InMemoryAccountSignerRepository) {
  repository.createAccountWithSigner({
    account: sourceAccount(),
    signer: sourceSigner(),
    attachedAt: now,
  });
}

describe('existing-wallet HD default selection', () => {
  it('keeps the source default until durable derivation succeeds and the new default is persisted', async () => {
    const repository = new InMemoryAccountSignerRepository();
    seedSource(repository);
    const preferences = createPreferences();
    const dependencies = createDependencies(repository);

    const derived = await deriveExistingWalletAccount(dependencies, {
      sourceSignerId: 'source-signer',
      index: 1,
      appPassphrase: 'current app passphrase',
    });

    expect(preferences.read()).toBe('source-account');
    expect(derived.account.signer.backupState).toBe('confirmed');

    selectPersistedAccountAndDefault(repository, derived.account.account.id, dependencies.networkId, preferences.store);

    expect(preferences.read()).toBe(derived.account.account.id);
    expect(
      resolvePreferredVisibleAccountId(
        repository.listAccounts(),
        dependencies.networkId,
        preferences.store.getDefaultAccountId(dependencies.networkId),
      ),
    ).toBe(derived.account.account.id);
  });

  it('preserves old current/default authority when default persistence fails after derivation', async () => {
    const repository = new InMemoryAccountSignerRepository();
    seedSource(repository);
    const preferences = createPreferences(new Error('default-write-failed'));
    const dependencies = createDependencies(repository);

    const derived = await deriveExistingWalletAccount(dependencies, {
      sourceSignerId: 'source-signer',
      index: 1,
      appPassphrase: 'current app passphrase',
    });

    expect(() =>
      selectPersistedAccountAndDefault(
        repository,
        derived.account.account.id,
        dependencies.networkId,
        preferences.store,
      ),
    ).toThrow('default-write-failed');

    expect(preferences.read()).toBe('source-account');
    expect(repository.getAccount(derived.account.account.id)).toEqual(derived.account.account);
    expect(repository.getSigner(derived.account.signer.id)).toEqual(derived.account.signer);
    expect(
      resolvePreferredVisibleAccountId(
        repository.listAccounts(),
        dependencies.networkId,
        preferences.store.getDefaultAccountId(dependencies.networkId),
      ),
    ).toBe('source-account');
  });
});
