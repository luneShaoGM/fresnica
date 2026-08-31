import type {AccountRecord} from '../../capabilities/account/types';
import type {MainTab} from './productRoutes';

export type ProductDestination =
  | Readonly<{tab: 'wallet'; route: 'wallet-home'}>
  | Readonly<{tab: 'wallet'; route: 'account-details'; accountId: string}>
  | Readonly<{tab: 'activity'; route: 'history'}>
  | Readonly<{tab: 'settings'; route: 'settings-home'}>
  | Readonly<{tab: 'settings'; route: 'accounts-settings'}>
  | Readonly<{tab: 'settings'; route: 'network-settings'}>
  | Readonly<{tab: 'settings'; route: 'about'}>;

export type ProductNavigationState = Readonly<{
  selectedAccountId: string;
  destination: ProductDestination;
}>;

export type ProductNavigationAction =
  | Readonly<{type: 'select-tab'; tab: MainTab}>
  | Readonly<{type: 'select-account'; accountId: string}>
  | Readonly<{type: 'open-account'; accountId: string}>
  | Readonly<{type: 'open-settings-route'; route: 'accounts-settings' | 'network-settings' | 'about'}>
  | Readonly<{type: 'back-to-root'}>;

export function createInitialProductNavigation(
  accounts: readonly AccountRecord[],
): ProductNavigationState {
  const firstAccount = firstVisibleAccount(accounts);
  if (!firstAccount) {
    throw new Error('product-navigation-requires-account');
  }

  return {
    selectedAccountId: firstAccount.id,
    destination: {tab: 'wallet', route: 'wallet-home'},
  };
}

export function reconcileProductNavigation(
  state: ProductNavigationState,
  accounts: readonly AccountRecord[],
): ProductNavigationState {
  if (accounts.some(account => account.id === state.selectedAccountId && !account.hidden)) {
    return state;
  }

  const firstAccount = firstVisibleAccount(accounts);
  if (!firstAccount) {
    throw new Error('product-navigation-requires-account');
  }

  return {
    selectedAccountId: firstAccount.id,
    destination: rootDestination(state.destination.tab),
  };
}

export function reduceProductNavigation(
  state: ProductNavigationState,
  action: ProductNavigationAction,
  accounts: readonly AccountRecord[],
): ProductNavigationState {
  switch (action.type) {
    case 'select-tab':
      return {...state, destination: rootDestination(action.tab)};
    case 'select-account':
      assertSelectableAccount(accounts, action.accountId);
      return {
        selectedAccountId: action.accountId,
        destination: {tab: 'wallet', route: 'wallet-home'},
      };
    case 'open-account':
      assertSelectableAccount(accounts, action.accountId);
      return {
        ...state,
        destination: {
          tab: 'wallet',
          route: 'account-details',
          accountId: action.accountId,
        },
      };
    case 'open-settings-route':
      return {
        ...state,
        destination: {tab: 'settings', route: action.route},
      };
    case 'back-to-root':
      return {
        ...state,
        destination: rootDestination(state.destination.tab),
      };
    default:
      throw new Error('unsupported-product-navigation-action');
  }
}

export function resolveSelectedAccount(
  state: ProductNavigationState,
  accounts: readonly AccountRecord[],
): AccountRecord {
  const account = accounts.find(
    candidate => candidate.id === state.selectedAccountId && !candidate.hidden,
  );
  if (!account) {
    throw new Error('selected-account-unavailable');
  }
  return account;
}

export function nextSelectableAccountId(
  state: ProductNavigationState,
  accounts: readonly AccountRecord[],
): string {
  const visibleAccounts = accounts.filter(account => !account.hidden);
  if (visibleAccounts.length === 0) {
    throw new Error('product-navigation-requires-account');
  }

  const currentIndex = visibleAccounts.findIndex(
    account => account.id === state.selectedAccountId,
  );
  const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % visibleAccounts.length;
  return visibleAccounts[nextIndex].id;
}

function rootDestination(tab: MainTab): ProductDestination {
  switch (tab) {
    case 'wallet':
      return {tab, route: 'wallet-home'};
    case 'activity':
      return {tab, route: 'history'};
    case 'settings':
      return {tab, route: 'settings-home'};
  }
}

function firstVisibleAccount(accounts: readonly AccountRecord[]): AccountRecord | undefined {
  return accounts.find(account => !account.hidden);
}

function assertSelectableAccount(
  accounts: readonly AccountRecord[],
  accountId: string,
): void {
  if (!accounts.some(account => account.id === accountId && !account.hidden)) {
    throw new Error('account-not-selectable');
  }
}
