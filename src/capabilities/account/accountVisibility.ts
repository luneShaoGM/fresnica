import type {AccountSignerRepository} from './AccountSignerRepository';
import type {AccountRecord} from './types';

export type AccountVisibilityDependencies = Readonly<{
  repository: AccountSignerRepository;
  now: () => Date;
}>;

export function setAccountHidden(
  dependencies: AccountVisibilityDependencies,
  accountId: string,
  hidden: boolean,
): AccountRecord {
  const account = dependencies.repository.getAccount(accountId);
  if (!account) {
    throw new Error('account-not-found');
  }

  if (account.hidden === hidden) {
    return account;
  }

  if (hidden) {
    const visibleAccounts = dependencies.repository
      .listAccounts()
      .filter(candidate => !candidate.hidden);
    if (visibleAccounts.length <= 1) {
      throw new Error('last-visible-account-cannot-be-hidden');
    }
  }

  const updatedAt = dependencies.now();
  dependencies.repository.setAccountHidden(accountId, hidden, updatedAt);
  return {...account, hidden, updatedAt};
}
