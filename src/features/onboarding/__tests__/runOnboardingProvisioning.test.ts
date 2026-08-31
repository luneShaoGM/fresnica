import type {FresnicaSdk} from '../../../platform/fresnica/FresnicaSdk';
import type {AccountIdentity, GenerateMnemonicInput} from '../../../platform/fresnica/types';
import {InMemoryAccountSignerRepository} from '../../../platform/persistence/memory/InMemoryAccountSignerRepository';
import type {ProvisionAccountDependencies} from '../../../capabilities/account/provisionAccount';
import {
  runGeneratedMnemonicOnboarding,
  runMnemonicImportOnboarding,
  runSecretImportOnboarding,
  runWatchOnlyOnboarding,
} from '../runOnboardingProvisioning';

const now = new Date('2026-08-28T00:00:00.000Z');

function createDependencies() {
  const repository = new InMemoryAccountSignerRepository();
  const sdk = {
    parseAccount: jest.fn(
      async (address: string): Promise<AccountIdentity> => ({
        kind: 'classic',
        address,
        publicKey: address,
      }),
    ),
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
    sdk: sdk as unknown as FresnicaSdk,
    repository,
    createId: kind => `${kind}-${++nextId}`,
    now: () => now,
  };

  return {dependencies, repository, sdk};
}

describe('onboarding provisioning flow', () => {
  it('registers watch-only on the app network and completes', async () => {
    const {dependencies, repository} = createDependencies();

    const result = await runWatchOnlyOnboarding(dependencies, {
      address: 'GWATCH',
      label: 'Watch',
    });

    expect(result.account.networkId).toBe('stellar-testnet');
    expect(repository.isWatchOnly(result.account.id)).toBe(true);
    expect(result.state).toEqual({method: 'watch-only', step: 'complete'});
  });

  it('imports a secret without returning the plaintext input', async () => {
    const {dependencies} = createDependencies();

    const result = await runSecretImportOnboarding(dependencies, {
      secret: 'SPLAINTEXT',
      appPassphrase: 'a strong app passphrase',
    });

    expect(result.account.account.networkId).toBe('stellar-testnet');
    expect(result.state).toEqual({method: 'import-secret', step: 'complete'});
    expect(JSON.stringify(result)).not.toContain('SPLAINTEXT');
    expect(JSON.stringify(result)).not.toContain('a strong app passphrase');
  });

  it('imports a mnemonic without returning recovery material', async () => {
    const {dependencies} = createDependencies();

    const result = await runMnemonicImportOnboarding(dependencies, {
      mnemonic: 'one two three',
      mnemonicPassphrase: '',
      index: 0,
      language: 'english',
      appPassphrase: 'a strong app passphrase',
    });

    expect(result.account.account.networkId).toBe('stellar-testnet');
    expect(result.state).toEqual({method: 'import-mnemonic', step: 'complete'});
    expect(JSON.stringify(result)).not.toContain('one two three');
    expect(JSON.stringify(result)).not.toContain('a strong app passphrase');
  });

  it('returns generated recovery material only in the one-time backup result', async () => {
    const {dependencies, repository} = createDependencies();

    const result = await runGeneratedMnemonicOnboarding(dependencies, {
      language: 'english',
      strength: 128,
      mnemonicPassphrase: '',
      index: 0,
      appPassphrase: 'a strong app passphrase',
    });

    expect(result.state).toEqual({
      method: 'generate-mnemonic',
      step: 'backup-generated-mnemonic',
    });
    expect(result.backup).toEqual({
      mnemonic: 'alpha beta gamma',
      language: 'english',
      index: 0,
    });
    expect(JSON.stringify(result.state)).not.toContain('alpha beta gamma');
    expect(JSON.stringify(result.account)).not.toContain('alpha beta gamma');
    expect(JSON.stringify(repository.getSigner(result.account.signer.id))).not.toContain(
      'alpha beta gamma',
    );
  });
});
