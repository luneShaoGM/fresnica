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
  it('uses the first visible account', () => {
    expect(firstVisibleAccountId([account('hidden', 0, true), ...accounts])).toBe('one');
  });

  it('cycles through visible accounts only', () => {
    const withHidden = [account('one', 0), account('hidden', 1, true), account('two', 2)];
    expect(nextVisibleAccountId(withHidden, 'one')).toBe('two');
    expect(nextVisibleAccountId(withHidden, 'two')).toBe('one');
  });

  it('reconciles removed or hidden selection to the first visible account', () => {
    expect(reconcileVisibleAccountId([accounts[0]], 'two')).toBe('one');
    expect(reconcileVisibleAccountId([account('one', 0, true), accounts[1]], 'one')).toBe('two');
  });

  it('fails closed when an account is not selectable', () => {
    expect(() => resolveVisibleAccount(accounts, 'missing')).toThrow('account-not-selectable');
  });
});
