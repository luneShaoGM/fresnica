import type {HistoryCacheRepository} from '../history/HistoryCacheRepository';
import type {PendingSubmissionRepository} from '../transaction/pendingSubmission';
import type {AccountSignerRepository} from './AccountSignerRepository';

export type DeleteLocalAccountDependencies = Readonly<{
  repository: AccountSignerRepository;
  pendingSubmissions: PendingSubmissionRepository;
  historyCache: Pick<HistoryCacheRepository, 'clearPartition'>;
}>;

export function deleteLocalAccount(
  dependencies: DeleteLocalAccountDependencies,
  accountId: string,
): void {
  const account = dependencies.repository.getAccount(accountId);
  if (!account) {
    throw new Error('account-not-found');
  }

  const hasUnresolvedSubmission = dependencies.pendingSubmissions
    .listUnresolved(account.networkId)
    .some(record => record.accountId === accountId);
  if (hasUnresolvedSubmission) {
    throw new Error('account-delete-blocked-by-pending-submission');
  }

  const remainingAccounts = dependencies.repository
    .listAccounts()
    .filter(candidate => candidate.id !== accountId);
  if (
    !account.hidden &&
    remainingAccounts.length > 0 &&
    remainingAccounts.every(candidate => candidate.hidden)
  ) {
    throw new Error('account-delete-requires-visible-account');
  }

  if (account.identityKind === 'classic') {
    dependencies.historyCache.clearPartition({
      networkId: account.networkId,
      accountAddress: account.address,
    });
  }
  dependencies.repository.deleteAccount(accountId);
}
