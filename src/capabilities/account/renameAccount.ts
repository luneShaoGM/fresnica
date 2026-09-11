import type { AccountSignerRepository } from './AccountSignerRepository';
import type { AccountRecord } from './types';

export type RenameAccountDependencies = Readonly<{
  repository: AccountSignerRepository;
  now: () => Date;
}>;

export function renameAccount(
  dependencies: RenameAccountDependencies,
  accountId: string,
  label: string,
): AccountRecord {
  const account = dependencies.repository.getAccount(accountId);
  if (!account) {
    throw new Error('account-not-found');
  }

  const normalizedLabel = label.trim();
  if (normalizedLabel === account.label) {
    return account;
  }

  const updatedAt = dependencies.now();
  dependencies.repository.setAccountLabel(accountId, normalizedLabel, updatedAt);

  return { ...account, label: normalizedLabel, updatedAt };
}
