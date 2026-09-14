import {orderAccounts} from '@capabilities/account/accountOrder';
import type {AccountRecord} from '@capabilities/account/types';

export function firstVisibleAccountId(accounts: readonly AccountRecord[]): string {
  const account = orderedVisibleAccounts(accounts)[0];
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
  const visibleAccounts = orderedVisibleAccounts(accounts);
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
  previousAccounts: readonly AccountRecord[] = accounts,
): string {
  if (accounts.some(account => account.id === accountId && !account.hidden)) {
    return accountId;
  }

  const previousVisible = orderedVisibleAccounts(previousAccounts);
  const previousIndex = previousVisible.findIndex(account => account.id === accountId);
  if (previousIndex >= 0) {
    for (let offset = 1; offset < previousVisible.length; offset += 1) {
      const candidate = previousVisible[(previousIndex + offset) % previousVisible.length];
      if (accounts.some(account => account.id === candidate.id && !account.hidden)) {
        return candidate.id;
      }
    }
  }

  return firstVisibleAccountId(accounts);
}

function orderedVisibleAccounts(accounts: readonly AccountRecord[]): AccountRecord[] {
  return orderAccounts(accounts.filter(account => !account.hidden));
}
