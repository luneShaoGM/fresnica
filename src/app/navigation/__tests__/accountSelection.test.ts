import type {AccountRecord} from '@capabilities/account/types';

import {
  firstVisibleAccountId,
  nextVisibleAccountId,
  reconcileVisibleAccountId,
  resolveVisibleAccount,
} from '../accountSelection';

function account(id: string, sortOrder: number, hidden = false): AccountRecord {
  return {
    id,
    address: `G${id}`,
    identityKind: 'classic',
    networkId: 'stellar-testnet',
    label: id,
    sortOrder,
    hidden,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };
}

const accounts = [account('one', 0), account('two', 1)];

describe('accountSelection', () => {
  it('uses stable sort order for the first visible account', () => {
    expect(
      firstVisibleAccountId([
        account('two', 20),
        account('hidden', 0, true),
        account('one', 10),
      ]),
    ).toBe('one');
  });

  it('cycles through visible accounts in stable sort order only', () => {
    const withHidden = [
      account('two', 20),
      account('hidden', 15, true),
      account('one', 10),
    ];
    expect(nextVisibleAccountId(withHidden, 'one')).toBe('two');
    expect(nextVisibleAccountId(withHidden, 'two')).toBe('one');
  });

  it('keeps a still-visible selection', () => {
    expect(reconcileVisibleAccountId(accounts, 'two')).toBe('two');
  });

  it('keeps the current visible account when sort order changes', () => {
    const reordered = [account('one', 1), account('two', 0)];
    expect(reconcileVisibleAccountId(reordered, 'two', accounts)).toBe('two');
  });

  it('selects the next prior-order account after the current account is removed', () => {
    const previous = [account('one', 0), account('two', 1), account('three', 2)];
    const current = [account('one', 0), account('three', 2)];

    expect(reconcileVisibleAccountId(current, 'two', previous)).toBe('three');
  });

  it('selects the next prior-order account after the current account is hidden', () => {
    const previous = [account('one', 0), account('two', 1), account('three', 2)];
    const current = [account('one', 0), account('two', 1, true), account('three', 2)];

    expect(reconcileVisibleAccountId(current, 'two', previous)).toBe('three');
  });

  it('fails closed when an account is not selectable', () => {
    expect(() => resolveVisibleAccount(accounts, 'missing')).toThrow('account-not-selectable');
  });
});
