import type { AccountRecord } from '@capabilities/account/types';
import type { Contact, Contacts } from '@capabilities/contacts/contacts';
import type { NetworkContext } from '@capabilities/network/types';
import type { RequestOutputPort } from '@capabilities/request/RequestOutputPort';
import { buildRequestUri } from '@capabilities/request/requestUri';
import type { StellarPaymentMemo } from '@capabilities/stellar/types';

export type ContactBook = Contacts &
  Readonly<{
    network: NetworkContext;
    copyPublicText(text: string): Promise<void>;
    output: RequestOutputPort;
  }>;
export type Recipient = Readonly<{ address: string; memo?: StellarPaymentMemo }>;

export function contactShareUri(book: ContactBook, recipient: Recipient): string {
  return buildRequestUri(book, { ...recipient, destination: recipient.address, network: book.network });
}

export function contactRecipient(book: ContactBook, id: string): Recipient {
  const contact = book.store.list(book.network.id).find(row => row.id === id);
  if (!contact) throw new Error('contact-not-found');
  return { address: contact.address, ...(contact.memo ? { memo: contact.memo } : {}) };
}

export function recipientFields(recipient: Recipient) {
  return {
    destination: recipient.address,
    memoType: recipient.memo?.type ?? ('none' as const),
    memoValue: recipient.memo?.value ?? '',
  };
}

export function destinationAccounts(accounts: readonly AccountRecord[], networkId: string, query: string) {
  const text = query.trim().toLocaleLowerCase();
  return accounts.filter(
    account =>
      account.networkId === networkId &&
      !account.hidden &&
      account.identityKind === 'classic' &&
      [account.label, account.address].some(value => value.toLocaleLowerCase().includes(text)),
  );
}

export function contactSubtitle(contact: Contact): string {
  return [contact.address, contact.memo ? `${contact.memo.type}: ${contact.memo.value}` : undefined]
    .filter(Boolean)
    .join(' · ');
}

export function contactError(error: unknown, t: (key: string) => string): string {
  const messages: Record<string, string> = {
    'contact-name-invalid': 'contacts.error.name',
    'contact-address-invalid': 'contacts.error.address',
    'contact-memo-invalid': 'contacts.error.memo',
    'contact-duplicate': 'contacts.error.duplicate',
    'contact-not-found': 'contacts.error.missing',
    'payment-memo-too-long': 'send.memo.error.textTooLong',
    'payment-memo-id-invalid': 'send.memo.error.idInvalid',
    'payment-memo-hash-invalid': 'send.memo.error.hashInvalid',
  };
  return t(error instanceof Error ? (messages[error.message] ?? 'contacts.error.storage') : 'contacts.error.storage');
}
