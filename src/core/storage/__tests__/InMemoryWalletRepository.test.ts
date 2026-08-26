import { InMemoryWalletRepository } from '../InMemoryWalletRepository';
import type { AccountRecord, SignerRecord } from '../domain/types';

const now = new Date('2026-08-26T00:00:00.000Z');

const account = (id: string, address = `G${id}`): AccountRecord => ({
  id,
  address,
  identityKind: 'classic',
  networkId: 'stellar-testnet',
  label: id,
  sortOrder: 0,
  hidden: false,
  createdAt: now,
  updatedAt: now,
});

const signer = (id: string): SignerRecord => ({
  id,
  publicKey: `G${id}`,
  kind: 'protected-software',
  envelopeJson: '{}',
  envelopeRevision: 'rev-1',
  recoveryKind: 'secret',
  backupState: 'not-required',
  createdAt: now,
  updatedAt: now,
});

describe('InMemoryWalletRepository', () => {
  it('downgrades an account to watch-only without deleting the account', () => {
    const repo = new InMemoryWalletRepository();
    repo.createAccount(account('account-a'));
    repo.createSigner(signer('signer-a'));
    repo.attachSigner('account-a', 'signer-a', now);

    repo.detachSigner('account-a', 'signer-a');

    expect(repo.getAccount('account-a')).toBeDefined();
    expect(repo.isWatchOnly('account-a')).toBe(true);
    expect(repo.getSigner('signer-a')).toBeUndefined();
  });

  it('preserves a shared signer when one account is deleted', () => {
    const repo = new InMemoryWalletRepository();
    repo.createAccount(account('account-a'));
    repo.createAccount(account('account-b'));
    repo.createSigner(signer('shared'));
    repo.attachSigner('account-a', 'shared', now);
    repo.attachSigner('account-b', 'shared', now);

    repo.deleteAccount('account-a');

    expect(repo.getAccount('account-a')).toBeUndefined();
    expect(repo.getAccount('account-b')).toBeDefined();
    expect(repo.getSigner('shared')).toBeDefined();
    expect(repo.isWatchOnly('account-b')).toBe(false);
  });

  it('deletes an orphan signer when its last account is deleted', () => {
    const repo = new InMemoryWalletRepository();
    repo.createAccount(account('account-a'));
    repo.createSigner(signer('signer-a'));
    repo.attachSigner('account-a', 'signer-a', now);

    repo.deleteAccount('account-a');

    expect(repo.getSigner('signer-a')).toBeUndefined();
  });

  it('rejects duplicate account identity on the same network', () => {
    const repo = new InMemoryWalletRepository();
    repo.createAccount(account('account-a', 'GABC'));

    expect(() => repo.createAccount(account('account-b', 'GABC'))).toThrow(
      'duplicate-account-identity',
    );
  });
});
