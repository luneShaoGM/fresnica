import type { AccountRecord } from '@capabilities/account/types';

export function activityHistoryPartitionKey(account: Pick<AccountRecord, 'networkId' | 'address'>): string {
  return JSON.stringify([account.networkId, account.address]);
}
