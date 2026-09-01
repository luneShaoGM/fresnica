import type {AccountRecord} from '../../../capabilities/account/types';
import {
  createInitialProductNavigation,
  nextSelectableAccountId,
  reconcileProductNavigation,
  reduceProductNavigation,
  resolveSelectedAccount,
} from '../productNavigationState';
import {MAIN_TABS, PRODUCT_ACTIONS} from '../productRoutes';

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

describe('productNavigationState', () => {
  it('starts at Home with the first visible account', () => {
    expect(createInitialProductNavigation([account('hidden', 0, true), ...accounts])).toEqual({
      selectedAccountId: 'one',
      destination: {tab: 'home', route: 'home'},
    });
  });

  it('switches product tabs to their root destinations without changing the selected account', () => {
    const initial = createInitialProductNavigation(accounts);
    const events = reduceProductNavigation(
      initial,
      {type: 'select-tab', tab: 'events'},
      accounts,
    );
    const xapps = reduceProductNavigation(
      events,
      {type: 'select-tab', tab: 'xapps'},
      accounts,
    );
    const settings = reduceProductNavigation(
      xapps,
      {type: 'select-tab', tab: 'settings'},
      accounts,
    );

    expect(events).toEqual({
      selectedAccountId: 'one',
      destination: {tab: 'events', route: 'events'},
    });
    expect(xapps).toEqual({
      selectedAccountId: 'one',
      destination: {tab: 'xapps', route: 'xapps'},
    });
    expect(settings).toEqual({
      selectedAccountId: 'one',
      destination: {tab: 'settings', route: 'settings-home'},
    });
  });

  it('keeps product actions separate from selectable tabs', () => {
    expect(MAIN_TABS).toEqual(['home', 'events', 'xapps', 'settings']);
    expect(PRODUCT_ACTIONS).toEqual(['send', 'swap', 'request']);
    expect(MAIN_TABS).not.toContain('actions');
  });

  it('selecting another account returns to Home for that account', () => {
    const next = reduceProductNavigation(
      createInitialProductNavigation(accounts),
      {type: 'select-account', accountId: 'two'},
      accounts,
    );

    expect(next.selectedAccountId).toBe('two');
    expect(next.destination).toEqual({tab: 'home', route: 'home'});
    expect(resolveSelectedAccount(next, accounts).id).toBe('two');
  });

  it('cycles only through visible accounts', () => {
    const withHidden = [account('one', 0), account('hidden', 1, true), account('two', 2)];
    const initial = createInitialProductNavigation(withHidden);

    expect(nextSelectableAccountId(initial, withHidden)).toBe('two');
    const second = reduceProductNavigation(
      initial,
      {type: 'select-account', accountId: 'two'},
      withHidden,
    );
    expect(nextSelectableAccountId(second, withHidden)).toBe('one');
  });

  it('reconciles a removed selected account to the first visible account', () => {
    const selectedSecond = reduceProductNavigation(
      createInitialProductNavigation(accounts),
      {type: 'select-account', accountId: 'two'},
      accounts,
    );

    expect(reconcileProductNavigation(selectedSecond, [accounts[0]])).toEqual({
      selectedAccountId: 'one',
      destination: {tab: 'home', route: 'home'},
    });
  });

  it('fails closed for hidden or unknown account selection', () => {
    const initial = createInitialProductNavigation(accounts);

    expect(() =>
      reduceProductNavigation(
        initial,
        {type: 'select-account', accountId: 'missing'},
        accounts,
      ),
    ).toThrow('account-not-selectable');
  });

  it('fails closed for an unknown runtime action', () => {
    const initial = createInitialProductNavigation(accounts);

    expect(() =>
      reduceProductNavigation(
        initial,
        {type: 'future-route'} as never,
        accounts,
      ),
    ).toThrow('unsupported-product-navigation-action');
  });
});
