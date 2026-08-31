import type {FresnicaSdk} from '../../../platform/fresnica/FresnicaSdk';
import {InMemoryAccountSignerRepository} from '../../../platform/persistence/memory/InMemoryAccountSignerRepository';
import type {ProvisionAccountDependencies} from '../../../capabilities/account/provisionAccount';
import type {AccountRecord} from '../../../capabilities/account/types';
import type {SignerRecord} from '../../../capabilities/signer/types';
import {
  confirmMnemonicBackup,
  recoverPendingMnemonicBackup,
  resolveOnboardingBootstrap,
} from '../onboardingBootstrap';

const now = new Date('2026-08-28T00:00:00.000Z');

function account(): AccountRecord {
  return {
    id: 'account-a',
    address: 'GACCOUNT',
    identityKind: 'classic',
    networkId: 'stellar-testnet',
    label: 'Primary',
    sortOrder: 0,
    hidden: false,
    createdAt: now,
    updatedAt: now,
  };
}

function pendingSigner(): SignerRecord {
  return {
    id: 'signer-a',
    publicKey: 'GSIGNER',
    kind: 'protected-software',
    envelopeJson: '{opaque-envelope}',
    recoveryKind: 'mnemonic',
    backupState: 'pending',
    createdAt: now,
    updatedAt: now,
  };
}

function createDependencies() {
  const repository = new InMemoryAccountSignerRepository();
  const reveal = jest.fn(async () => ({
    kind: 'mnemonic' as const,
    mnemonic: 'alpha beta gamma',
    language: 'english',
    index: 0,
  }));
  const dependencies: ProvisionAccountDependencies = {
    repository,
    sdk: {reveal} as unknown as FresnicaSdk,
    createId: () => 'unused',
    now: () => new Date('2026-08-29T00:00:00.000Z'),
  };
  return {dependencies, repository, reveal};
}

describe('onboarding bootstrap', () => {
  it('starts onboarding when no account exists', () => {
    const {dependencies} = createDependencies();
    expect(resolveOnboardingBootstrap(dependencies)).toEqual({kind: 'onboarding'});
  });

  it('resumes pending generated-mnemonic backup after restart', () => {
    const {dependencies, repository} = createDependencies();
    repository.createAccountWithSigner({
      account: account(),
      signer: pendingSigner(),
      attachedAt: now,
    });

    expect(resolveOnboardingBootstrap(dependencies)).toEqual({
      kind: 'pending-mnemonic-backup',
      signerId: 'signer-a',
      signerPublicKey: 'GSIGNER',
    });
  });

  it('recovers pending mnemonic only through fresh-passphrase reveal', async () => {
    const {dependencies, repository, reveal} = createDependencies();
    repository.createAccountWithSigner({
      account: account(),
      signer: pendingSigner(),
      attachedAt: now,
    });

    await expect(
      recoverPendingMnemonicBackup(
        dependencies,
        'signer-a',
        'a strong app passphrase',
      ),
    ).resolves.toEqual({
      mnemonic: 'alpha beta gamma',
      language: 'english',
      index: 0,
    });

    expect(reveal).toHaveBeenCalledWith({
      envelopeJson: '{opaque-envelope}',
      freshAppPasscode: 'a strong app passphrase',
      expectedSignerPublicKey: 'GSIGNER',
    });
  });

  it('marks backup confirmed and then boots ready', () => {
    const {dependencies, repository} = createDependencies();
    repository.createAccountWithSigner({
      account: account(),
      signer: pendingSigner(),
      attachedAt: now,
    });

    confirmMnemonicBackup(dependencies, 'signer-a');

    expect(repository.getSigner('signer-a')?.backupState).toBe('confirmed');
    expect(resolveOnboardingBootstrap(dependencies)).toEqual({
      kind: 'ready',
      accounts: [account()],
    });
  });
});
