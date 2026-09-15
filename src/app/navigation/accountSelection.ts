import { orderAccounts } from '@capabilities/account/accountOrder';
import type { AccountRecord } from '@capabilities/account/types';

import type { AccountSelectionPreferenceStore } from '../accountSelectionPreferences';

export function selectableAccountsForNetwork(accounts: readonly AccountRecord[], networkId: string): AccountRecord[] {
  return orderAccounts(accounts.filter(account => account.networkId === networkId && !account.hidden));
}

export function resolvePreferredVisibleAccountId(
  accounts: readonly AccountRecord[],
  networkId: string,
  preferredAccountId?: string,
): string | undefined {
  const selectable = selectableAccountsForNetwork(accounts, networkId);
  if (preferredAccountId && selectable.some(account => account.id === preferredAccountId)) {
    return preferredAccountId;
  }

  return selectable[0]?.id;
}

export function firstVisibleAccountId(accounts: readonly AccountRecord[], networkId?: string): string {
  const account = orderedVisibleAccounts(accounts, networkId)[0];
  if (!account) {
    throw new Error('main-navigation-requires-account');
  }
  return account.id;
}

export function resolveVisibleAccount(accounts: readonly AccountRecord[], accountId: string): AccountRecord {
  const account = accounts.find(candidate => candidate.id === accountId && !candidate.hidden);
  if (!account) {
    throw new Error('account-not-selectable');
  }
  return account;
}

export function resolveSelectableAccountForNetwork(
  accounts: readonly AccountRecord[],
  accountId: string,
  networkId: string,
): AccountRecord {
  const account = accounts.find(
    candidate => candidate.id === accountId && candidate.networkId === networkId && !candidate.hidden,
  );
  if (!account) {
    throw new Error('account-not-selectable');
  }
  return account;
}

export function selectAndPersistDefaultAccountId(
  accounts: readonly AccountRecord[],
  accountId: string,
  networkId: string,
  preferences: AccountSelectionPreferenceStore,
): string {
  resolveSelectableAccountForNetwork(accounts, accountId, networkId);
  preferences.setDefaultAccountId(networkId, accountId);
  return accountId;
}

export function persistResolvedDefaultAccountId(
  preferences: AccountSelectionPreferenceStore,
  networkId: string,
  accountId: string,
): void {
  if (preferences.getDefaultAccountId(networkId) === accountId) {
    return;
  }
  preferences.setDefaultAccountId(networkId, accountId);
}

export function reconcileVisibleAccountId(
  accounts: readonly AccountRecord[],
  accountId: string,
  previousAccounts: readonly AccountRecord[] = accounts,
  networkId?: string,
): string {
  if (
    accounts.some(
      account =>
        account.id === accountId && !account.hidden && (networkId === undefined || account.networkId === networkId),
    )
  ) {
    return accountId;
  }

  const previousVisible = orderedVisibleAccounts(previousAccounts, networkId);
  const previousIndex = previousVisible.findIndex(account => account.id === accountId);
  if (previousIndex >= 0) {
    for (let offset = 1; offset < previousVisible.length; offset += 1) {
      const candidate = previousVisible[(previousIndex + offset) % previousVisible.length];
      if (
        accounts.some(
          account =>
            account.id === candidate.id &&
            !account.hidden &&
            (networkId === undefined || account.networkId === networkId),
        )
      ) {
        return candidate.id;
      }
    }
  }

  return firstVisibleAccountId(accounts, networkId);
}

function orderedVisibleAccounts(accounts: readonly AccountRecord[], networkId?: string): AccountRecord[] {
  return orderAccounts(
    accounts.filter(account => !account.hidden && (networkId === undefined || account.networkId === networkId)),
  );
}
