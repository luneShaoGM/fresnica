import type { AccountRecord } from '../../../../capabilities/account/types';
import type { SignerRecord } from '../../../../capabilities/signer/types';
import { InMemoryAccountSignerRepository } from '../InMemoryAccountSignerRepository';

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

describe('InMemoryAccountSignerRepository', () => {
  it('derives watch-only state from signer references', () => {
    const repository = new InMemoryAccountSignerRepository();
    const accountRecord = account('account-a');
    const signerRecord = signer('signer-a');

    repository.createAccount(accountRecord);
    expect(repository.isWatchOnly(accountRecord.id)).toBe(true);

    repository.createSigner(signerRecord);
    repository.attachSigner(accountRecord.id, signerRecord.id, now);
    expect(repository.isWatchOnly(accountRecord.id)).toBe(false);

    repository.detachSigner(accountRecord.id, signerRecord.id);
    expect(repository.isWatchOnly(accountRecord.id)).toBe(true);
  });

  it('preserves a shared signer while another account still references it', () => {
    const repository = new InMemoryAccountSignerRepository();
    repository.createAccount(account('account-a'));
    repository.createAccount(account('account-b'));
    repository.createSigner(signer('shared'));
    repository.attachSigner('account-a', 'shared', now);
    repository.attachSigner('account-b', 'shared', now);

    repository.deleteAccount('account-a');

    expect(repository.getSigner('shared')).toBeDefined();
    expect(repository.isWatchOnly('account-b')).toBe(false);
  });
});
