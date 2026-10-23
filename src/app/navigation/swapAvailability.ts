import type { AccountRecord } from '@capabilities/account/types';

export function isSwapAvailableForAccount(account: AccountRecord, canSign: boolean): boolean {
  return account.identityKind === 'classic' && canSign;
}
