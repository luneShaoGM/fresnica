import type {AccountRecord} from '@capabilities/account/types';

export function firstVisibleAccountId(accounts: readonly AccountRecord[]): string {
  const account = accounts.find(candidate => !candidate.hidden);
  if (!account) {
    throw new Error('main-navigation-requires-account');
  }
  return account.id;
}

export function resolveVisibleAccount(
  accounts: readonly AccountRecord[],
  accountId: string,
): AccountRecord {
  const account = accounts.find(candidate => candidate.id === accountId && !candidate.hidden);
  if (!account) {
    throw new Error('account-not-selectable');
  }
  return account;
}

export function nextVisibleAccountId(
  accounts: readonly AccountRecord[],
  accountId: string,
): string {
  const visibleAccounts = accounts.filter(account => !account.hidden);
  if (visibleAccounts.length === 0) {
    throw new Error('main-navigation-requires-account');
  }

  const currentIndex = visibleAccounts.findIndex(account => account.id === accountId);
  const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % visibleAccounts.length;
  return visibleAccounts[nextIndex].id;
}

export function reconcileVisibleAccountId(
  accounts: readonly AccountRecord[],
  accountId: string,
): string {
  return accounts.some(account => account.id === accountId && !account.hidden)
    ? accountId
    : firstVisibleAccountId(accounts);
}
