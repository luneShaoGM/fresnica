import type {AccountSignerRepository} from '../../../capabilities/account/AccountSignerRepository';
import type {AccountRecord} from '../../../capabilities/account/types';
import type {SignerRecord} from '../../../capabilities/signer/types';

const now = new Date('2026-08-28T00:00:00.000Z');

function account(
  id: string,
  address = `G${id}`,
  networkId = 'stellar-testnet',
): AccountRecord {
  return {
    id,
    address,
    identityKind: 'classic',
    networkId,
    label: id,
    sortOrder: 0,
    hidden: false,
    createdAt: now,
    updatedAt: now,
  };
}

function signer(id: string): SignerRecord {
  return {
    id,
    publicKey: `G${id}`,
    kind: 'protected-software',
    envelopeJson: '{opaque-envelope}',
    envelopeRevision: 'rev-1',
    recoveryKind: 'secret',
    backupState: 'not-required',
    providerId: 'provider-a',
    providerMetadataJson: '{opaque-provider-metadata}',
    createdAt: now,
    updatedAt: now,
  };
}

export function runAccountSignerRepositoryContract(
  createRepository: () => AccountSignerRepository,
): void {
  it('round-trips accounts and signers through detached domain records', () => {
    const repository = createRepository();
    const accountRecord = account('account-a');
    const signerRecord = signer('signer-a');

    repository.createAccount(accountRecord);
    repository.createSigner(signerRecord);

    expect(repository.getAccount(accountRecord.id)).toEqual(accountRecord);
    expect(repository.getSigner(signerRecord.id)).toEqual(signerRecord);
  });

  it('lists detached accounts and signers for application bootstrap', () => {
    const repository = createRepository();
    const accountRecord = account('account-a');
    const signerRecord = signer('signer-a');
    repository.createAccount(accountRecord);
    repository.createSigner(signerRecord);

    expect(repository.listAccounts()).toEqual([accountRecord]);
    expect(repository.listSigners()).toEqual([signerRecord]);
  });

  it('updates signer backup state without changing protected material', () => {
    const repository = createRepository();
    const signerRecord = {...signer('signer-a'), backupState: 'pending' as const};
    const updatedAt = new Date('2026-08-29T00:00:00.000Z');
    repository.createSigner(signerRecord);

    repository.setSignerBackupState('signer-a', 'confirmed', updatedAt);

    expect(repository.getSigner('signer-a')).toEqual({
      ...signerRecord,
      backupState: 'confirmed',
      updatedAt,
    });
  });

  it('rejects backup-state updates for a missing signer', () => {
    const repository = createRepository();
    expect(() =>
      repository.setSignerBackupState('missing', 'confirmed', now),
    ).toThrow('signer-not-found');
  });

  it('registers an account and signer as one attached wallet state', () => {
    const repository = createRepository();
    const accountRecord = account('account-a');
    const signerRecord = signer('signer-a');

    repository.createAccountWithSigner({
      account: accountRecord,
      signer: signerRecord,
      attachedAt: now,
    });

    expect(repository.getAccount(accountRecord.id)).toEqual(accountRecord);
    expect(repository.getSigner(signerRecord.id)).toEqual(signerRecord);
    expect(repository.isWatchOnly(accountRecord.id)).toBe(false);
  });

  it('lists only signers attached to the requested account', () => {
    const repository = createRepository();
    const accountA = account('account-a');
    const accountB = account('account-b');
    const signerA = signer('signer-a');
    const signerB = signer('signer-b');
    repository.createAccount(accountA);
    repository.createAccount(accountB);
    repository.createSigner(signerA);
    repository.createSigner(signerB);
    repository.attachSigner(accountA.id, signerA.id, now);
    repository.attachSigner(accountB.id, signerB.id, now);

    expect(repository.listSignersForAccount(accountA.id)).toEqual([signerA]);
    expect(repository.listSignersForAccount(accountB.id)).toEqual([signerB]);
    expect(repository.listSignersForAccount('missing')).toEqual([]);
  });

  it('does not persist a signer when atomic registration rejects the account', () => {
    const repository = createRepository();
    repository.createAccount(account('existing', 'GABC'));

    expect(() =>
      repository.createAccountWithSigner({
        account: account('duplicate', 'GABC'),
        signer: signer('new-signer'),
        attachedAt: now,
      }),
    ).toThrow('duplicate-account-identity');

    expect(repository.getAccount('duplicate')).toBeUndefined();
    expect(repository.getSigner('new-signer')).toBeUndefined();
  });

  it('rejects duplicate account identity on the same network', () => {
    const repository = createRepository();
    repository.createAccount(account('account-a', 'GABC'));

    expect(() => repository.createAccount(account('account-b', 'GABC'))).toThrow(
      'duplicate-account-identity',
    );
  });

  it('allows the same address on a different network', () => {
    const repository = createRepository();
    repository.createAccount(account('account-a', 'GABC', 'stellar-testnet'));
    repository.createAccount(account('account-b', 'GABC', 'stellar-mainnet'));

    expect(repository.getAccount('account-a')).toBeDefined();
    expect(repository.getAccount('account-b')).toBeDefined();
  });

  it('derives watch-only state from account-signer references', () => {
    const repository = createRepository();
    repository.createAccount(account('account-a'));
    repository.createSigner(signer('signer-a'));

    expect(repository.isWatchOnly('account-a')).toBe(true);
    repository.attachSigner('account-a', 'signer-a', now);
    expect(repository.isWatchOnly('account-a')).toBe(false);

    repository.detachSigner('account-a', 'signer-a');
    expect(repository.isWatchOnly('account-a')).toBe(true);
    expect(repository.getSigner('signer-a')).toBeUndefined();
  });

  it('rejects attaching missing accounts and signers', () => {
    const repository = createRepository();
    repository.createAccount(account('account-a'));
    repository.createSigner(signer('signer-a'));

    expect(() => repository.attachSigner('missing', 'signer-a', now)).toThrow(
      'account-not-found',
    );
    expect(() => repository.attachSigner('account-a', 'missing', now)).toThrow(
      'signer-not-found',
    );
  });

  it('preserves a shared signer until its final reference is removed', () => {
    const repository = createRepository();
    repository.createAccount(account('account-a'));
    repository.createAccount(account('account-b'));
    repository.createSigner(signer('shared'));
    repository.attachSigner('account-a', 'shared', now);
    repository.attachSigner('account-b', 'shared', now);

    repository.deleteAccount('account-a');
    expect(repository.getSigner('shared')).toBeDefined();
    expect(repository.isWatchOnly('account-b')).toBe(false);

    repository.deleteAccount('account-b');
    expect(repository.getSigner('shared')).toBeUndefined();
  });
}
