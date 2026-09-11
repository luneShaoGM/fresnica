import { InMemoryAccountSignerRepository } from '../../../platform/persistence/memory/InMemoryAccountSignerRepository';
import { moveAccount, nextAccountSortOrder, orderAccounts } from '../accountOrder';
import type { AccountRecord } from '../types';

const createdAt = new Date('2026-09-11T00:00:00.000Z');
const updatedAt = new Date('2026-09-11T01:00:00.000Z');

function account(
  id: string,
  sortOrder: number,
  options: Readonly<{ hidden?: boolean; createdAt?: Date }> = {},
): AccountRecord {
  return {
    id,
    address: `G${id}`,
    identityKind: 'classic',
    networkId: 'stellar-testnet',
    label: id,
    sortOrder,
    hidden: options.hidden ?? false,
    createdAt: options.createdAt ?? createdAt,
    updatedAt: createdAt,
  };
}

describe('account order', () => {
  it('uses sortOrder, then createdAt, then id as stable order', () => {
    expect(
      orderAccounts([
        account('c', 1),
        account('b', 0, { createdAt: new Date('2026-09-11T00:01:00.000Z') }),
        account('a', 0),
      ]).map(candidate => candidate.id),
    ).toEqual(['a', 'b', 'c']);
  });

  it('moves an account and changes only local sort metadata', () => {
    const repository = new InMemoryAccountSignerRepository();
    repository.createAccount(account('a', 0));
    repository.createAccount(account('b', 1));
    repository.createAccount(account('c', 2, { hidden: true }));

    const result = moveAccount({ repository, now: () => updatedAt }, 'c', 'up');

    expect(result.map(candidate => candidate.id)).toEqual(['a', 'c', 'b']);
    expect(repository.getAccount('c')).toEqual({
      ...account('c', 2, { hidden: true }),
      sortOrder: 1,
      updatedAt,
    });
    expect(repository.getAccount('b')).toEqual({ ...account('b', 1), sortOrder: 2, updatedAt });
    expect(repository.getAccount('a')).toEqual(account('a', 0));
  });

  it('does not write when moving beyond either boundary', () => {
    const repository = new InMemoryAccountSignerRepository();
    repository.createAccount(account('a', 0));
    repository.createAccount(account('b', 1));
    const now = jest.fn(() => updatedAt);

    expect(moveAccount({ repository, now }, 'a', 'up').map(candidate => candidate.id)).toEqual(['a', 'b']);
    expect(moveAccount({ repository, now }, 'b', 'down').map(candidate => candidate.id)).toEqual(['a', 'b']);
    expect(now).not.toHaveBeenCalled();
  });

  it('rejects a missing account', () => {
    const repository = new InMemoryAccountSignerRepository();
    expect(() => moveAccount({ repository, now: () => updatedAt }, 'missing', 'up')).toThrow('account-not-found');
  });

  it('appends new sort orders after the current maximum', () => {
    expect(nextAccountSortOrder([account('a', 4), account('b', 1)])).toBe(5);
    expect(nextAccountSortOrder([])).toBe(0);
  });
});
