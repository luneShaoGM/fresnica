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
  const plainContactNames = new Map<string, string | undefined>();
  for (const contact of contacts) {
    if (contact.memo !== undefined || !contact.name.trim()) continue;
    if (plainContactNames.has(contact.address)) {
      plainContactNames.set(contact.address, undefined);
    } else {
      plainContactNames.set(contact.address, contact.name);
    }
  }
  for (const [address, name] of plainContactNames) {
    if (name) names.set(address, name);
  }
  return names;
}
