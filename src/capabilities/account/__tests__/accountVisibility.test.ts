import {InMemoryAccountSignerRepository} from '../../../platform/persistence/memory/InMemoryAccountSignerRepository';
import {setAccountHidden} from '../accountVisibility';
import type {AccountRecord} from '../types';

const createdAt = new Date('2026-09-01T00:00:00.000Z');
const updatedAt = new Date('2026-09-11T01:00:00.000Z');

function account(id: string, hidden = false): AccountRecord {
  return {
    id,
    address: `G${id}`,
    identityKind: 'classic',
    networkId: 'stellar-testnet',
    label: id,
    sortOrder: 0,
    hidden,
    createdAt,
    updatedAt: createdAt,
  };
}

describe('setAccountHidden', () => {
  it('hides an account when another visible account remains', () => {
    const repository = new InMemoryAccountSignerRepository();
    repository.createAccount(account('account-a'));
    repository.createAccount(account('account-b'));

    const result = setAccountHidden(
      {repository, now: () => updatedAt},
      'account-a',
      true,
    );

    expect(result).toEqual({...account('account-a'), hidden: true, updatedAt});
    expect(repository.getAccount('account-a')).toEqual(result);
  });

  it('refuses to hide the last visible account', () => {
    const repository = new InMemoryAccountSignerRepository();
    repository.createAccount(account('account-a'));
    repository.createAccount(account('account-b', true));

    expect(() =>
      setAccountHidden({repository, now: () => updatedAt}, 'account-a', true),
    ).toThrow('last-visible-account-cannot-be-hidden');
    expect(repository.getAccount('account-a')).toEqual(account('account-a'));
  });

  it('restores a hidden account', () => {
    const repository = new InMemoryAccountSignerRepository();
    repository.createAccount(account('account-a', true));

    const result = setAccountHidden(
      {repository, now: () => updatedAt},
      'account-a',
      false,
    );

    expect(result).toEqual({...account('account-a', true), hidden: false, updatedAt});
  });

  it('does not rewrite metadata when visibility is unchanged', () => {
    const repository = new InMemoryAccountSignerRepository();
    const original = account('account-a');
    repository.createAccount(original);

    expect(
      setAccountHidden({repository, now: () => updatedAt}, 'account-a', false),
    ).toEqual(original);
    expect(repository.getAccount('account-a')).toEqual(original);
  });

  it('fails closed for a missing account', () => {
    const repository = new InMemoryAccountSignerRepository();
    expect(() =>
      setAccountHidden({repository, now: () => updatedAt}, 'missing', true),
    ).toThrow('account-not-found');
  });
});
