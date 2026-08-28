import type {FresnicaSdk} from '../../../platform/fresnica/FresnicaSdk';
import {InMemoryAccountSignerRepository} from '../../../platform/persistence/memory/InMemoryAccountSignerRepository';
import {
  generateMnemonicAccount,
  importMnemonicAccount,
  importSecretAccount,
  registerWatchOnlyAccount,
  type ProvisionAccountDependencies,
} from '../provisionAccount';

const now = new Date('2026-08-28T00:00:00.000Z');

function createDependencies() {
  const repository = new InMemoryAccountSignerRepository();
  const calls: Array<{method: string; input: unknown}> = [];
  const sdk = {
    parseAccount: jest.fn(async (address: string) => {
      calls.push({method: 'parseAccount', input: address});
      return {kind: 'classic' as const, address, publicKey: address};
    }),
    protectSecret: jest.fn(async input => {
      calls.push({method: 'protectSecret', input});
      return {signerPublicKey: 'GSECRET', envelopeJson: '{secret-envelope}'};
    }),
    protectMnemonic: jest.fn(async input => {
      calls.push({method: 'protectMnemonic', input});
      return {signerPublicKey: 'GMNEMONIC', envelopeJson: '{mnemonic-envelope}'};
    }),
    generateMnemonic: jest.fn(async input => {
      calls.push({method: 'generateMnemonic', input});
      return {
        signer: {signerPublicKey: 'GGENERATED', envelopeJson: '{generated-envelope}'},
        mnemonic: 'alpha beta gamma',
        language: input.language,
        index: input.index,
      };
    }),
  } as Pick<FresnicaSdk, 'parseAccount' | 'protectSecret' | 'protectMnemonic' | 'generateMnemonic'>;

  let nextId = 0;
  const dependencies: ProvisionAccountDependencies = {
    sdk: sdk as FresnicaSdk,
    repository,
    createId: kind => `${kind}-${++nextId}`,
    now: () => now,
  };

  return {dependencies, repository, sdk, calls};
}

describe('account provisioning', () => {
  it('registers watch-only identity without creating a signer', async () => {
    const {dependencies, repository, sdk} = createDependencies();

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

  it('imports a secret through Fresnica and persists only the protected signer', async () => {
    const {dependencies, repository, sdk} = createDependencies();

    const result = await importSecretAccount(dependencies, {
      secret: 'SPLAINTEXT',
      appPassphrase: 'a strong app passphrase',
      networkId: 'stellar-testnet',
    });

    expect(sdk.protectSecret).toHaveBeenCalledWith({
      secret: 'SPLAINTEXT',
      appPasscode: 'a strong app passphrase',
    });
    expect(result.account.address).toBe('GSECRET');
    expect(result.signer.envelopeJson).toBe('{secret-envelope}');
    expect(result.signer.recoveryKind).toBe('secret');
    expect(result.signer.backupState).toBe('not-required');
    expect(repository.isWatchOnly(result.account.id)).toBe(false);
    expect(JSON.stringify(result)).not.toContain('SPLAINTEXT');
  });

  it('imports mnemonic material through Fresnica and does not return plaintext recovery material', async () => {
    const {dependencies, repository, sdk} = createDependencies();

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
      appPasscode: 'a strong app passphrase',
    });
    expect(result.account.address).toBe('GMNEMONIC');
    expect(result.signer.recoveryKind).toBe('mnemonic');
    expect(result.signer.backupState).toBe('confirmed');
    expect(repository.isWatchOnly(result.account.id)).toBe(false);
    expect(JSON.stringify(result)).not.toContain('one two three');
  });

  it('returns generated mnemonic only as one-time result and marks backup pending', async () => {
    const {dependencies, repository, sdk} = createDependencies();

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
      appPasscode: 'a strong app passphrase',
    });
    expect(result.mnemonic).toBe('alpha beta gamma');
    expect(result.signer.backupState).toBe('pending');
    expect(repository.getSigner(result.signer.id)?.envelopeJson).toBe('{generated-envelope}');
    expect(JSON.stringify(repository.getSigner(result.signer.id))).not.toContain('alpha beta gamma');
  });

  it('rejects a non-classic identity before persistence for software signer provisioning', async () => {
    const {dependencies, repository, sdk} = createDependencies();
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
