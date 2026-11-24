import type { FresnicaSdkPort } from '../../ports/FresnicaSdkPort';
import type { AccountIdentity, GenerateMnemonicInput } from '../../ports/fresnicaTypes';
import { InMemoryAccountSignerRepository } from '../../../platform/persistence/memory/InMemoryAccountSignerRepository';
import {
  generateMnemonicAccount,
  importMnemonicAccount,
  importSecretAccount,
  registerWatchOnlyAccount,
  subscribeMnemonicAccountCreation,
  type GenerateMnemonicAccountInput,
  type ProvisionAccountDependencies,
} from '../provisionAccount';

const now = new Date('2026-08-28T00:00:00.000Z');
const generateInput: GenerateMnemonicAccountInput = {
  language: 'english',
  strength: 128,
  mnemonicPassphrase: '',
  index: 0,
  appPassphrase: 'a strong app passphrase',
  networkId: 'stellar-testnet',
};
const generatedMaterial = {
  signer: { signerPublicKey: 'GGENERATED', envelopeJson: '{generated-envelope}' },
  mnemonic: 'alpha beta gamma',
  language: 'english',
  index: 0,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((accept, fail) => { resolve = accept; reject = fail; });
  return { promise, resolve, reject };
}

async function settleMicrotasks() {
  for (let i = 0; i < 6; i += 1) await Promise.resolve();
}

function createDependencies() {
  const repository = new InMemoryAccountSignerRepository();
  const sdk = {
    parseAccount: jest.fn(async (address: string): Promise<AccountIdentity> => ({
      kind: 'classic',
      address,
      publicKey: address,
    })),
    protectSecret: jest.fn(async () => ({
      signerPublicKey: 'GSECRET',
      envelopeJson: '{secret-envelope}',
    })),
    protectMnemonic: jest.fn(async () => ({
      signerPublicKey: 'GMNEMONIC',
      envelopeJson: '{mnemonic-envelope}',
    })),
    generateMnemonic: jest.fn(async (input: GenerateMnemonicInput) => ({
      signer: {
        signerPublicKey: 'GGENERATED',
        envelopeJson: '{generated-envelope}',
      },
      mnemonic: 'alpha beta gamma',
      language: input.language,
      index: input.index,
    })),
  };

  let nextId = 0;
  const dependencies: ProvisionAccountDependencies = {
    sdk: sdk as unknown as FresnicaSdkPort,
    repository,
    createId: kind => `${kind}-${++nextId}`,
    now: () => now,
  };

  return { dependencies, repository, sdk };
}

describe('account provisioning', () => {
  it('registers watch-only identity without creating a signer', async () => {
    const { dependencies, repository, sdk } = createDependencies();

    const account = await registerWatchOnlyAccount(dependencies, {
      address: 'GWATCH',
      networkId: 'stellar-testnet',
      label: ' Watch ',
    });

    expect(sdk.parseAccount).toHaveBeenCalledWith('GWATCH');
    expect(account.label).toBe('Watch');
    expect(repository.getAccount(account.id)).toEqual(account);
    expect(repository.isWatchOnly(account.id)).toBe(true);
  });

  it('appends newly provisioned accounts after the current local sort order', async () => {
    const { dependencies } = createDependencies();

    const first = await registerWatchOnlyAccount(dependencies, {
      address: 'GFIRST',
      networkId: 'stellar-testnet',
    });
    const second = await registerWatchOnlyAccount(dependencies, {
      address: 'GSECOND',
      networkId: 'stellar-testnet',
    });

    expect(first.sortOrder).toBe(0);
    expect(second.sortOrder).toBe(1);
  });

  it('imports a secret through Fresnica and persists only the protected signer', async () => {
    const { dependencies, repository, sdk } = createDependencies();

    const result = await importSecretAccount(dependencies, {
      secret: 'SPLAINTEXT',
      appPassphrase: 'a strong app passphrase',
      networkId: 'stellar-testnet',
    });

    expect(sdk.protectSecret).toHaveBeenCalledWith({
      secret: 'SPLAINTEXT',
      appPassphrase: 'a strong app passphrase',
    });
    expect(result.account.address).toBe('GSECRET');
    expect(result.signer.envelopeJson).toBe('{secret-envelope}');
    expect(result.signer.recoveryKind).toBe('secret');
    expect(result.signer.backupState).toBe('not-required');
    expect(repository.isWatchOnly(result.account.id)).toBe(false);
    expect(JSON.stringify(result)).not.toContain('SPLAINTEXT');
  });

  it('imports mnemonic material through Fresnica and does not return plaintext recovery material', async () => {
    const { dependencies, repository, sdk } = createDependencies();

    const result = await importMnemonicAccount(dependencies, {
      mnemonic: 'one two three',
      mnemonicPassphrase: '',
      index: 0,
      language: 'english',
      appPassphrase: 'a strong app passphrase',
      networkId: 'stellar-testnet',
    });

    expect(sdk.protectMnemonic).toHaveBeenCalledWith({
      mnemonic: 'one two three',
      mnemonicPassphrase: '',
      index: 0,
      language: 'english',
      appPassphrase: 'a strong app passphrase',
    });
    expect(result.account.address).toBe('GMNEMONIC');
    expect(result.signer.recoveryKind).toBe('mnemonic');
    expect(result.signer.backupState).toBe('not-required');
    expect(repository.isWatchOnly(result.account.id)).toBe(false);
    expect(JSON.stringify(result)).not.toContain('one two three');
  });

  it('upgrades a visible same-network watch-only account in place during secret import', async () => {
    const { dependencies, repository } = createDependencies();
    const existing = await registerWatchOnlyAccount(dependencies, {
      address: 'GSECRET',
      networkId: 'stellar-testnet',
      label: 'Existing watch',
    });

    const result = await importSecretAccount(dependencies, {
      secret: 'SPLAINTEXT',
      appPassphrase: 'a strong app passphrase',
      networkId: 'stellar-testnet',
      label: 'Ignored import label',
    });

    expect(result.account).toEqual(existing);
    expect(repository.listAccounts()).toEqual([existing]);
    expect(repository.listSignersForAccount(existing.id)).toEqual([result.signer]);
    expect(repository.isWatchOnly(existing.id)).toBe(false);
  });

  it('rejects same-network import when that account already has signing authority', async () => {
    const { dependencies, repository } = createDependencies();
    await importSecretAccount(dependencies, {
      secret: 'SPLAINTEXT',
      appPassphrase: 'a strong app passphrase',
      networkId: 'stellar-testnet',
    });

    await expect(
      importSecretAccount(dependencies, {
        secret: 'SPLAINTEXT',
        appPassphrase: 'a strong app passphrase',
        networkId: 'stellar-testnet',
      }),
    ).rejects.toThrow('account-already-exists');

    expect(repository.listAccounts()).toHaveLength(1);
    expect(repository.listSigners()).toHaveLength(1);
  });

  it('does not implicitly restore a hidden watch-only account during import', async () => {
    const { dependencies, repository } = createDependencies();
    const existing = await registerWatchOnlyAccount(dependencies, {
      address: 'GSECRET',
      networkId: 'stellar-testnet',
    });
    repository.setAccountHidden(existing.id, true, now);

    await expect(
      importSecretAccount(dependencies, {
        secret: 'SPLAINTEXT',
        appPassphrase: 'a strong app passphrase',
        networkId: 'stellar-testnet',
      }),
    ).rejects.toThrow('account-not-selectable');

    expect(repository.isWatchOnly(existing.id)).toBe(true);
    expect(repository.listSigners()).toEqual([]);
  });

  it('allows the same imported public key to create an account on another network', async () => {
    const { dependencies, repository } = createDependencies();
    await registerWatchOnlyAccount(dependencies, {
      address: 'GSECRET',
      networkId: 'stellar-mainnet',
    });

    const result = await importSecretAccount(dependencies, {
      secret: 'SPLAINTEXT',
      appPassphrase: 'a strong app passphrase',
      networkId: 'stellar-testnet',
    });

    expect(result.account.networkId).toBe('stellar-testnet');
    expect(repository.listAccounts()).toHaveLength(2);
  });

  it('returns generated mnemonic only as one-time result and marks backup pending', async () => {
    const { dependencies, repository, sdk } = createDependencies();

    const result = await generateMnemonicAccount(dependencies, {
      language: 'english',
      strength: 128,
      mnemonicPassphrase: '',
      index: 0,
      appPassphrase: 'a strong app passphrase',
      networkId: 'stellar-testnet',
    });

    expect(sdk.generateMnemonic).toHaveBeenCalledWith({
      language: 'english',
      strength: 128,
      mnemonicPassphrase: '',
      index: 0,
      appPassphrase: 'a strong app passphrase',
    });
    expect(result.mnemonic).toBe('alpha beta gamma');
    expect(result.signer.backupState).toBe('pending');
    expect(repository.getSigner(result.signer.id)?.envelopeJson).toBe('{generated-envelope}');
    expect(JSON.stringify(repository.getSigner(result.signer.id))).not.toContain('alpha beta gamma');
  });

  it('keeps one repository creation through SDK generation and delayed parsing without sharing or queuing its result', async () => {
    const { dependencies, repository, sdk } = createDependencies();
    const generation = deferred<typeof generatedMaterial>();
    const parsing = deferred<AccountIdentity>();
    sdk.generateMnemonic.mockReturnValueOnce(generation.promise);
    sdk.parseAccount.mockReturnValueOnce(parsing.promise);

    const first = generateMnemonicAccount(dependencies, generateInput);
    const replacementSettled = jest.fn();
    const replacement = generateMnemonicAccount({ ...dependencies }, generateInput).then(
      value => replacementSettled({ value }),
      error => replacementSettled({ error }),
    );
    expect(sdk.generateMnemonic).toHaveBeenCalledTimes(1);
    expect(replacementSettled).not.toHaveBeenCalled();

    generation.resolve(generatedMaterial);
    await settleMicrotasks();
    expect(sdk.parseAccount).toHaveBeenCalledTimes(1);
    expect(repository.listSigners()).toEqual([]);
    expect(replacementSettled).not.toHaveBeenCalled();

    parsing.resolve({ kind: 'classic', address: 'GGENERATED', publicKey: 'GGENERATED' });
    const result = await first;
    await replacement;
    expect(result.mnemonic).toBe(generatedMaterial.mnemonic);
    expect(replacementSettled).toHaveBeenCalledWith({ error: new Error('mnemonic-creation-in-progress') });
    expect(sdk.generateMnemonic).toHaveBeenCalledTimes(1);
    expect(repository.listAccounts()).toEqual([result.account]);
    expect(repository.listSigners()).toEqual([result.signer]);
  });

  it.each(['generation', 'parse', 'persistence'] as const)('releases the creation after %s failure for an explicit retry only', async phase => {
    const { dependencies, repository, sdk } = createDependencies();
    const generation = deferred<typeof generatedMaterial>();
    const creationSettled = jest.fn();
    const unsubscribe = subscribeMnemonicAccountCreation(repository, creationSettled);
    sdk.generateMnemonic.mockReturnValueOnce(generation.promise);
    if (phase === 'parse') sdk.parseAccount.mockRejectedValueOnce(new Error('parse-failed'));
    if (phase === 'persistence') {
      jest.spyOn(repository, 'createAccountWithSigner').mockImplementationOnce(() => { throw new Error('persistence-failed'); });
    }

    const first = generateMnemonicAccount(dependencies, generateInput);
    const firstFailure = expect(first).rejects.toThrow(`${phase}-failed`);
    const waiting = generateMnemonicAccount({ ...dependencies }, generateInput);
    const waitingFailure = expect(waiting).rejects.toThrow('mnemonic-creation-in-progress');
    if (phase === 'generation') generation.reject(new Error('generation-failed'));
    else generation.resolve(generatedMaterial);
    await Promise.all([firstFailure, waitingFailure]);
    expect(repository.listAccounts()).toEqual([]);
    expect(repository.listSigners()).toEqual([]);
    expect(sdk.generateMnemonic).toHaveBeenCalledTimes(1);
    expect(creationSettled.mock.calls).toEqual([[]]);

    const retried = await generateMnemonicAccount({ ...dependencies }, generateInput);
    expect(sdk.generateMnemonic).toHaveBeenCalledTimes(2);
    expect(repository.listSigners()).toEqual([retried.signer]);
    expect(creationSettled.mock.calls).toEqual([[], []]);
    unsubscribe();
  });

  it('blocks a persisted pending backup across networks before SDK work and permits a new account after confirmation', async () => {
    const { dependencies, repository, sdk } = createDependencies();
    const first = await generateMnemonicAccount(dependencies, generateInput);

    await expect(generateMnemonicAccount(dependencies, {
      ...generateInput, networkId: 'stellar-mainnet',
    })).rejects.toThrow('pending-mnemonic-backup-exists');
    expect(sdk.generateMnemonic).toHaveBeenCalledTimes(1);
    expect(repository.listSigners()).toEqual([first.signer]);

    repository.setSignerBackupState(first.signer.id, 'confirmed', now);
    sdk.generateMnemonic.mockResolvedValueOnce({
      ...generatedMaterial, signer: { signerPublicKey: 'GNEXT', envelopeJson: '{next-envelope}' },
    });
    const next = await generateMnemonicAccount(dependencies, generateInput);
    expect(sdk.generateMnemonic).toHaveBeenCalledTimes(2);
    expect(repository.listSigners().filter(signer => signer.backupState === 'pending')).toEqual([next.signer]);
    expect(repository.getSigner(first.signer.id)?.backupState).toBe('confirmed');
  });

  it('rechecks pending backup immediately before persistence even when another repository wrapper writes during parsing', async () => {
    const { dependencies, repository, sdk } = createDependencies();
    const parsing = deferred<AccountIdentity>();
    sdk.parseAccount.mockReturnValueOnce(parsing.promise);
    const first = generateMnemonicAccount(dependencies, generateInput);
    const firstFailure = expect(first).rejects.toThrow('pending-mnemonic-backup-exists');
    await settleMicrotasks();

    // A second repository object can address the same underlying store; its
    // separate operation gate cannot replace the persistence-time invariant.
    const otherRepository = new Proxy(repository, {});
    const second = await generateMnemonicAccount({
      ...dependencies,
      repository: otherRepository,
      sdk: {
        ...sdk,
        parseAccount: async (address: string): Promise<AccountIdentity> => ({ kind: 'classic', address, publicKey: address }),
        generateMnemonic: async () => ({
          ...generatedMaterial, signer: { signerPublicKey: 'GOTHER', envelopeJson: '{other-envelope}' },
        }),
      } as unknown as FresnicaSdkPort,
    }, generateInput);

    parsing.resolve({ kind: 'classic', address: 'GGENERATED', publicKey: 'GGENERATED' });
    await firstFailure;
    expect(repository.listAccounts()).toEqual([second.account]);
    expect(repository.listSigners()).toEqual([second.signer]);
  });

  it('does not block an independent repository or notify its observers', async () => {
    const first = createDependencies();
    const second = createDependencies();
    const generation = deferred<typeof generatedMaterial>();
    first.sdk.generateMnemonic.mockReturnValueOnce(generation.promise);
    const firstSettled = jest.fn();
    const unsubscribe = subscribeMnemonicAccountCreation(first.repository, firstSettled);

    const waiting = generateMnemonicAccount(first.dependencies, generateInput);
    const independent = await generateMnemonicAccount(second.dependencies, generateInput);
    expect(second.repository.listSigners()).toEqual([independent.signer]);
    expect(first.repository.listSigners()).toEqual([]);
    expect(firstSettled).not.toHaveBeenCalled();

    generation.resolve(generatedMaterial);
    await waiting;
    expect(firstSettled).toHaveBeenCalledTimes(1);
    expect(firstSettled).toHaveBeenCalledWith();
    unsubscribe();
  });

  it('isolates observer errors and removes retired subscriptions without publishing generated material', async () => {
    const { dependencies, repository } = createDependencies();
    const retired = jest.fn();
    const unsubscribeRetired = subscribeMnemonicAccountCreation(repository, retired);
    const unsubscribeThrowing = subscribeMnemonicAccountCreation(repository, () => { throw new Error('view-retired'); });
    const current = jest.fn();
    const unsubscribeCurrent = subscribeMnemonicAccountCreation(repository, current);
    unsubscribeRetired();

    const result = await generateMnemonicAccount(dependencies, generateInput);
    expect(result.signer.backupState).toBe('pending');
    expect(retired).not.toHaveBeenCalled();
    expect(current).toHaveBeenCalledTimes(1);
    expect(current).toHaveBeenCalledWith();
    unsubscribeThrowing();
    unsubscribeCurrent();
  });

  it('rejects a non-classic identity before persistence for software signer provisioning', async () => {
    const { dependencies, repository, sdk } = createDependencies();
    sdk.parseAccount.mockResolvedValueOnce({
      kind: 'contract',
      address: 'CCONTRACT',
    });

    await expect(
      importSecretAccount(dependencies, {
        secret: 'SPLAINTEXT',
        appPassphrase: 'a strong app passphrase',
        networkId: 'stellar-testnet',
      }),
    ).rejects.toThrow('unsupported-account-kind');

    expect(repository.getAccount('account-1')).toBeUndefined();
    expect(repository.getSigner('signer-2')).toBeUndefined();
  });
});
