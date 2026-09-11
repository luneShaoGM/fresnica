import { InMemoryAccountSignerRepository } from '../../../platform/persistence/memory/InMemoryAccountSignerRepository';
import { renameAccount } from '../renameAccount';
import type { AccountRecord } from '../types';

const createdAt = new Date('2026-09-01T00:00:00.000Z');
const updatedAt = new Date('2026-09-11T00:00:00.000Z');

function account(): AccountRecord {
  return {
    id: 'account-a',
    address: 'GABC',
    identityKind: 'classic',
    networkId: 'stellar-testnet',
    label: 'Old label',
    sortOrder: 7,
    hidden: false,
    createdAt,
    updatedAt: createdAt,
  };
}

describe('renameAccount', () => {
  it('updates only the trimmed label and updatedAt', () => {
    const repository = new InMemoryAccountSignerRepository();
    repository.createAccount(account());

    const result = renameAccount({ repository, now: () => updatedAt }, 'account-a', '  Primary wallet  ');

    expect(result).toEqual({ ...account(), label: 'Primary wallet', updatedAt });
    expect(repository.getAccount('account-a')).toEqual(result);
  });

  it('does not rewrite metadata when the trimmed label is unchanged', () => {
    const repository = new InMemoryAccountSignerRepository();
    const original = account();
    repository.createAccount(original);

    const result = renameAccount({ repository, now: () => updatedAt }, 'account-a', '  Old label  ');

    expect(result).toEqual(original);
    expect(repository.getAccount('account-a')).toEqual(original);
  });

  it('allows clearing a custom label', () => {
    const repository = new InMemoryAccountSignerRepository();
    repository.createAccount(account());

    const result = renameAccount({ repository, now: () => updatedAt }, 'account-a', '   ');

    expect(result.label).toBe('');
  });

  it('fails closed for a missing account', () => {
    const repository = new InMemoryAccountSignerRepository();
    expect(() => renameAccount({ repository, now: () => updatedAt }, 'missing', 'Wallet')).toThrow('account-not-found');
  });
});
