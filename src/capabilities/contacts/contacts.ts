import { validatePaymentMemo } from '../payment/preparePayment';
import type { StellarPaymentMemo } from '../stellar/types';

export type Contact = Readonly<{
  id: string;
  // Legacy creation network, retained for lossless migration; not contact scope.
  networkId: string;
  name: string;
  address: string;
  memo?: StellarPaymentMemo;
}>;
export type ContactDraft = Pick<Contact, 'name' | 'address' | 'memo'>;
export interface ContactStore {
  list(networkId: string): readonly Contact[];
  save(contact: Contact): void;
  remove(networkId: string, id: string): void;
  subscribe(listener: () => void): () => void;
  getRevision(): number;
}
export type Contacts = Readonly<{
  store: ContactStore;
  isClassicAccountAddress(address: string): boolean;
  createId(): string;
}>;

export function validateContactMemo(memo: unknown): StellarPaymentMemo | undefined {
  if (memo === undefined) return undefined;
  if (
    memo === null ||
    typeof memo !== 'object' ||
    !('type' in memo) ||
    !('value' in memo) ||
    typeof memo.value !== 'string' ||
    (memo.type !== 'text' && memo.type !== 'id' && memo.type !== 'hash')
  ) {
    throw new Error('contact-memo-invalid');
  }
  const normalized = validatePaymentMemo({ type: memo.type, value: memo.value });
  if (!normalized) throw new Error('contact-memo-invalid');
  return normalized;
}

export function contactIdentity(address: string, memo?: StellarPaymentMemo): string {
  const normalized = validateContactMemo(memo);
  return JSON.stringify([address.trim(), normalized?.type ?? '', normalized?.value ?? '']);
}

export function saveContact(dependencies: Contacts, networkId: string, draft: ContactDraft, id?: string): void {
  const name = draft.name.trim();
  const address = draft.address.trim();
  if (!name || name.length > 30 || /[\u0000-\u001f\u007f]/.test(name)) throw new Error('contact-name-invalid');
  if (!dependencies.isClassicAccountAddress(address)) throw new Error('contact-address-invalid');
  const memo = validateContactMemo(draft.memo);
  dependencies.store.save({ id: id ?? dependencies.createId(), networkId, name, address, ...(memo ? { memo } : {}) });
}

// An address alone must never pick an arbitrary exchange subaccount's memo/name.
export function findContact(
  contacts: readonly Contact[],
  address: string,
  memo?: StellarPaymentMemo,
): Contact | undefined {
  const key = contactIdentity(address, memo);
  const matches = contacts.filter(contact => contactIdentity(contact.address, contact.memo) === key);
  // Conflicting legacy network entries must not be resolved by insertion order.
  return matches.length === 1 ? matches[0] : undefined;
}

export function searchContacts(contacts: readonly Contact[], query: string): readonly Contact[] {
  const text = query.trim().toLocaleLowerCase();
  return contacts
    .filter(contact =>
      [contact.name, contact.address, contact.memo?.type, contact.memo?.value].some(value =>
        value?.toLocaleLowerCase().includes(text),
      ),
    )
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}
