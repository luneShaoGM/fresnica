import { useSyncExternalStore } from 'react';
import type { Contact } from '@capabilities/contacts/contacts';
import type { ContactBook } from './contactBook';

export function useContactList(book: ContactBook): Readonly<{ contacts: readonly Contact[]; failed: boolean }> {
  useSyncExternalStore(book.store.subscribe, book.store.getRevision, book.store.getRevision);
  try {
    return { contacts: book.store.list(book.network.id), failed: false };
  } catch {
    return { contacts: [], failed: true };
  }
}
