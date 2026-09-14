import type { AccountSignerRepository, AccountSortOrderUpdate } from './AccountSignerRepository';
import type { AccountRecord } from './types';

export type AccountOrderDependencies = Readonly<{
  repository: AccountSignerRepository;
  now: () => Date;
}>;

export type AccountMoveDirection = 'up' | 'down';

export function orderAccounts(accounts: readonly AccountRecord[]): AccountRecord[] {
  return accounts.slice().sort(compareAccountOrder);
}

export function nextAccountSortOrder(accounts: readonly AccountRecord[]): number {
  return accounts.reduce((highest, account) => Math.max(highest, account.sortOrder), -1) + 1;
}

export function moveAccount(
  dependencies: AccountOrderDependencies,
  accountId: string,
  direction: AccountMoveDirection,
): AccountRecord[] {
  const ordered = orderAccounts(dependencies.repository.listAccounts());
  const index = ordered.findIndex(account => account.id === accountId);
  if (index < 0) {
    throw new Error('account-not-found');
  }

  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= ordered.length) {
    return ordered;
  }

  const reordered = ordered.slice();
  [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];

  const updatedAt = dependencies.now();
  const updates: AccountSortOrderUpdate[] = reordered.flatMap((account, sortOrder) =>
    account.sortOrder === sortOrder ? [] : [{ accountId: account.id, sortOrder, updatedAt }],
  );
  dependencies.repository.setAccountSortOrders(updates);

  const updatedById = new Map(updates.map(update => [update.accountId, update]));
  return reordered.map(account => {
    const update = updatedById.get(account.id);
    return update ? { ...account, sortOrder: update.sortOrder, updatedAt: update.updatedAt } : account;
  });
}

function compareAccountOrder(left: AccountRecord, right: AccountRecord): number {
  if (left.sortOrder !== right.sortOrder) {
    return left.sortOrder - right.sortOrder;
  }

  const createdAtDelta = left.createdAt.getTime() - right.createdAt.getTime();
  if (createdAtDelta !== 0) {
    return createdAtDelta;
  }

  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}
