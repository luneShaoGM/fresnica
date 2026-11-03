import type { AccountRecord } from '@capabilities/account/types';
import type { Contact } from '@capabilities/contacts/contacts';
import { resolveLocalIdentityDisplay } from '@capabilities/contacts/resolveLocalIdentity';
import type { ActivityIdentityNames } from '@features/activity/activityRowPresentation';

export function activityIdentityNames(
  accounts: readonly AccountRecord[],
  contacts: readonly Contact[],
  networkId: string,
): ActivityIdentityNames {
  // Activity list rows do not carry an authoritative transaction memo.
  // Only address-only contacts may supply names here; memo-specific contacts
  // are resolved when an exact memo is known at the presentation boundary.
  const candidates = new Set<string>([
    ...accounts.map(account => account.address),
    ...contacts.filter(contact => contact.memo === undefined).map(contact => contact.address),
  ]);
  const names = new Map<string, string>();
  for (const address of candidates) {
    const resolved = resolveLocalIdentityDisplay({ address, contacts, accounts, networkId });
    if (resolved.source !== 'address') names.set(address, resolved.name);
  }
  return names;
}
