import type { AccountRecord } from '@capabilities/account/types';

import type { AccountSelectionPreferenceStore } from '../../accountSelectionPreferences';
import {
  firstVisibleAccountId,
  persistResolvedDefaultAccountId,
  reconcileVisibleAccountId,
  resolvePreferredVisibleAccountId,
  resolveSelectableAccountForNetwork,
  resolveVisibleAccount,
  selectAndPersistDefaultAccountId,
  selectableAccountsForNetwork,
} from '../accountSelection';

function account(id: string, sortOrder: number, hidden = false, networkId = 'stellar-testnet'): AccountRecord {
  return {
    id,
    address: `G${id}`,
    identityKind: 'classic',
    networkId,
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
    expect(firstVisibleAccountId([account('two', 20), account('hidden', 0, true), account('one', 10)])).toBe('one');
  });

  it('lists only visible accounts from the current network in stable order', () => {
    expect(
      selectableAccountsForNetwork(
        [
          account('other-network', 0, false, 'stellar-mainnet'),
          account('hidden', 1, true),
          account('second', 2),
          account('first', 0),
        ],
        'stellar-testnet',
      ).map(candidate => candidate.id),
    ).toEqual(['first', 'second']);
  });

  it('restores a valid persisted default on the same network', () => {
    expect(resolvePreferredVisibleAccountId(accounts, 'stellar-testnet', 'two')).toBe('two');
  });

  it('returns no preferred account when the current network has no visible account', () => {
    const candidates = [account('hidden', 0, true), account('mainnet', 0, false, 'stellar-mainnet')];

    expect(resolvePreferredVisibleAccountId(candidates, 'stellar-testnet', 'hidden')).toBeUndefined();
  });

  it.each([
    ['missing', 'missing'],
    ['hidden', 'hidden'],
    ['cross-network', 'mainnet'],
  ])('normalizes an invalid %s default to the first visible current-network account', (_, kind) => {
    const candidates = [account('one', 0), account('hidden', 1, true), account('mainnet', 0, false, 'stellar-mainnet')];
    const preferred = kind === 'missing' ? 'missing' : kind;
    expect(resolvePreferredVisibleAccountId(candidates, 'stellar-testnet', preferred)).toBe('one');
  });

  it('persists an explicit direct selection before returning the new session id', () => {
    const setDefaultAccountId = jest.fn();
    const preferences: AccountSelectionPreferenceStore = {
      getDefaultAccountId: jest.fn(),
      setDefaultAccountId,
      clearDefaultAccountId: jest.fn(),
    };

    expect(selectAndPersistDefaultAccountId(accounts, 'two', 'stellar-testnet', preferences)).toBe('two');
    expect(setDefaultAccountId).toHaveBeenCalledWith('stellar-testnet', 'two');
  });

  it('re-persists the already-current account when it is explicitly selected again', () => {
    const setDefaultAccountId = jest.fn();
    const preferences: AccountSelectionPreferenceStore = {
      getDefaultAccountId: jest.fn(),
      setDefaultAccountId,
      clearDefaultAccountId: jest.fn(),
    };

    expect(selectAndPersistDefaultAccountId(accounts, 'one', 'stellar-testnet', preferences)).toBe('one');
    expect(setDefaultAccountId).toHaveBeenCalledWith('stellar-testnet', 'one');
  });

  it('fails explicit selection before returning a new session id when persistence fails', () => {
    const error = new Error('write-failed');
    const preferences: AccountSelectionPreferenceStore = {
      getDefaultAccountId: jest.fn(),
      setDefaultAccountId: jest.fn(() => {
        throw error;
      }),
      clearDefaultAccountId: jest.fn(),
    };

    expect(() => selectAndPersistDefaultAccountId(accounts, 'two', 'stellar-testnet', preferences)).toThrow(error);
  });

  it('syncs an automatic fallback to persistence but avoids rewriting an already-matching default', () => {
    const setDefaultAccountId = jest.fn();
    const stalePreferences: AccountSelectionPreferenceStore = {
      getDefaultAccountId: jest.fn(() => 'deleted-account'),
      setDefaultAccountId,
      clearDefaultAccountId: jest.fn(),
    };

    persistResolvedDefaultAccountId(stalePreferences, 'stellar-testnet', 'one');
    expect(setDefaultAccountId).toHaveBeenCalledWith('stellar-testnet', 'one');

    setDefaultAccountId.mockClear();
    const currentPreferences: AccountSelectionPreferenceStore = {
      getDefaultAccountId: jest.fn(() => 'one'),
      setDefaultAccountId,
      clearDefaultAccountId: jest.fn(),
    };
    persistResolvedDefaultAccountId(currentPreferences, 'stellar-testnet', 'one');
    expect(setDefaultAccountId).not.toHaveBeenCalled();
  });

  it('does not let a restored hidden account steal an existing valid default', () => {
    const restored = [account('one', 0), account('two', 1)];
    expect(resolvePreferredVisibleAccountId(restored, 'stellar-testnet', 'one')).toBe('one');
  });

  it('rejects direct selection of hidden or cross-network accounts', () => {
    const candidates = [
      account('visible', 0),
      account('hidden', 1, true),
      account('mainnet', 0, false, 'stellar-mainnet'),
    ];
    expect(resolveSelectableAccountForNetwork(candidates, 'visible', 'stellar-testnet').id).toBe('visible');
    expect(() => resolveSelectableAccountForNetwork(candidates, 'hidden', 'stellar-testnet')).toThrow(
      'account-not-selectable',
    );
    expect(() => resolveSelectableAccountForNetwork(candidates, 'mainnet', 'stellar-testnet')).toThrow(
      'account-not-selectable',
    );
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

  it('keeps fallback reconciliation on the current network', () => {
    const previous = [account('one', 0), account('two', 1), account('mainnet', 2, false, 'stellar-mainnet')];
    const current = [account('one', 0), account('mainnet', 2, false, 'stellar-mainnet')];

    expect(reconcileVisibleAccountId(current, 'two', previous, 'stellar-testnet')).toBe('one');
  });

  it('fails closed when an account is not selectable', () => {
    expect(() => resolveVisibleAccount(accounts, 'missing')).toThrow('account-not-selectable');
  });
});
