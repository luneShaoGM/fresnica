import type { AccountRecord } from '../account/types';
import { contactIdentity, type Contact } from './contacts';
import type { StellarPaymentMemo } from '../stellar/types';

export type LocalIdentityDisplay = Readonly<{
  name: string;
  source: 'contact' | 'account' | 'address';
  match: 'exact' | 'address-only' | 'ambiguous' | 'none';
}>;

// Display-only resolver. In particular, an address-only fallback must never be
// used as the selected contact identity or to copy a saved memo into a Send.
export function resolveLocalIdentityDisplay({
  address,
  memo,
  contacts,
  accounts = [],
  networkId,
}: Readonly<{
  address: string;
  memo?: StellarPaymentMemo;
  contacts: readonly Contact[];
  accounts?: readonly AccountRecord[];
  networkId: string;
}>): LocalIdentityDisplay {
  const exactKey = contactIdentity(address, memo);
  const exact = contacts.filter(contact => contactIdentity(contact.address, contact.memo) === exactKey);
  let match: LocalIdentityDisplay['match'] = 'none';
  let resolved: Contact | undefined;

  if (exact.length > 1) {
    match = 'ambiguous';
  } else if (exact.length === 1) {
    match = 'exact';
    resolved = exact[0];
  } else if (memo !== undefined) {
    // Stellar displays a saved address-only name for a memo-bearing recipient
    // only when that address-only record is unique. A conflicting exact match
    // must never silently fall through to a different saved identity.
    const plainKey = contactIdentity(address);
    const plain = contacts.filter(contact => contactIdentity(contact.address, contact.memo) === plainKey);
    if (plain.length > 1) match = 'ambiguous';
    else if (plain.length === 1) {
      match = 'address-only';
      resolved = plain[0];
    }
  }

  if (resolved?.name.trim()) {
    return { name: resolved.name, source: 'contact', match };
  }

  const localAccounts = accounts.filter(
    account =>
      account.networkId === networkId &&
      account.identityKind === 'classic' &&
      !account.hidden &&
      account.address === address &&
      account.label.trim(),
  );
  if (localAccounts.length === 1) {
    return { name: localAccounts[0].label, source: 'account', match };
  }

  return { name: address, source: 'address', match };
}
