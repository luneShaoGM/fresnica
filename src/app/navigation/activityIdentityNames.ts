import type { AccountRecord } from '@capabilities/account/types';
import type { Contact } from '@capabilities/contacts/contacts';
import type { ActivityIdentityNames } from '@features/activity/activityRowPresentation';

export function activityIdentityNames(
  accounts: readonly AccountRecord[],
  contacts: readonly Contact[],
  networkId: string,
): ActivityIdentityNames {
  const names = new Map<string, string>();
  for (const account of accounts) {
    if (
      account.networkId === networkId &&
      account.identityKind === 'classic' &&
      !account.hidden &&
      account.label.trim()
    ) {
      names.set(account.address, account.label);
    }
  }
  for (const contact of contacts) {
    if (contact.networkId === networkId && contact.memo === undefined && contact.name.trim()) {
      names.set(contact.address, contact.name);
    }
  }
  return names;
}
