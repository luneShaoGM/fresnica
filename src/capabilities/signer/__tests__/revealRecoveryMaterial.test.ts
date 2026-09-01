import type {AccountRecord} from '../../account/types';
import type {FresnicaSdk} from '../../../platform/fresnica/FresnicaSdk';
import type {RevealedSigningMaterial} from '../../../platform/fresnica/types';
import {InMemoryAccountSignerRepository} from '../../../platform/persistence/memory/InMemoryAccountSignerRepository';
import {
  resolveRecoveryExportAccess,
  revealAccountRecoveryMaterial,
  type RecoveryExportDependencies,
} from '../revealRecoveryMaterial';
import type {SignerRecord} from '../types';

const createdAt = new Date('2026-09-01T00:00:00.000Z');

function account(id = 'account-1'): AccountRecord {
  return {
    id,
    address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    identityKind: 'classic',
    networkId: 'stellar-testnet',
    label: 'Primary',
    sortOrder: 0,
    hidden: false,
    createdAt,
    updatedAt: createdAt,
  };
}

function protectedSigner(
  overrides: Partial<SignerRecord> = {},
): SignerRecord {
  return {
    id: 'signer-1',
    publicKey: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    kind: 'protected-software',
    envelopeJson: '{"protected":true}',
    envelopeRevision: '1',
    recoveryKind: 'mnemonic',
    backupState: 'confirmed',
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

function createDependencies(
  revealed: RevealedSigningMaterial = {
    kind: 'mnemonic',
    mnemonic: 'alpha beta gamma',
    index: 0,
    language: 'english',
  },
): RecoveryExportDependencies & {sdk: jest.Mocked<FresnicaSdk>} {
  const repository = new InMemoryAccountSignerRepository();
  const sdk = {
    reveal: jest.fn().mockResolvedValue(revealed),
  } as unknown as jest.Mocked<FresnicaSdk>;
  return {repository, sdk};
}

function attach(
  dependencies: RecoveryExportDependencies,
  signer: SignerRecord,
): void {
  const record = account();
  dependencies.repository.createAccountWithSigner({
    account: record,
    signer,
    attachedAt: createdAt,
  });
}

describe('recovery export', () => {
  it('allows exactly one complete protected-software signer', () => {
    const dependencies = createDependencies();
    attach(dependencies, protectedSigner());

    expect(resolveRecoveryExportAccess(dependencies, 'account-1')).toEqual({
      status: 'available',
      signerId: 'signer-1',
      signerPublicKey: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
      recoveryKind: 'mnemonic',
    });
  });

  it('keeps watch-only accounts unavailable', () => {
    const dependencies = createDependencies();
    dependencies.repository.createAccount(account());

    expect(resolveRecoveryExportAccess(dependencies, 'account-1')).toEqual({
      status: 'watch-only',
    });
  });

  it('fails closed instead of choosing among multiple attached signers', () => {
    const dependencies = createDependencies();
    attach(dependencies, protectedSigner());
    dependencies.repository.createSigner(
      protectedSigner({id: 'signer-2', publicKey: 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBRG'}),
    );
    dependencies.repository.attachSigner('account-1', 'signer-2', createdAt);

    expect(resolveRecoveryExportAccess(dependencies, 'account-1')).toEqual({
      status: 'unsupported-multiple-signers',
    });
  });

  it('does not export hardware or external signer material', () => {
    const dependencies = createDependencies();
    attach(
      dependencies,
      protectedSigner({
        kind: 'hardware',
        envelopeJson: undefined,
        recoveryKind: undefined,
      }),
    );

    expect(resolveRecoveryExportAccess(dependencies, 'account-1')).toEqual({
      status: 'unsupported-signer',
      signerKind: 'hardware',
    });
  });

  it('passes a fresh passphrase and expected public key to Core reveal', async () => {
    const dependencies = createDependencies();
    attach(dependencies, protectedSigner());

    await expect(
      revealAccountRecoveryMaterial(dependencies, 'account-1', 'fresh-passphrase'),
    ).resolves.toEqual({
      kind: 'mnemonic',
      mnemonic: 'alpha beta gamma',
      index: 0,
      language: 'english',
    });
    expect(dependencies.sdk.reveal).toHaveBeenCalledWith({
      envelopeJson: '{"protected":true}',
      freshAppPasscode: 'fresh-passphrase',
      expectedSignerPublicKey:
        'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    });
  });

  it('fails closed when revealed material disagrees with persisted recovery kind', async () => {
    const dependencies = createDependencies({
      kind: 'secret',
      secret: 'SSECRET',
    });
    attach(dependencies, protectedSigner({recoveryKind: 'mnemonic'}));

    await expect(
      revealAccountRecoveryMaterial(dependencies, 'account-1', 'fresh-passphrase'),
    ).rejects.toThrow('recovery-export-kind-mismatch');
  });
});
