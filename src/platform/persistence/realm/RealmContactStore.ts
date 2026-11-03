import Realm from 'realm';

import {
  contactIdentity,
  validateContactMemo,
  type Contact,
  type ContactStore,
} from '../../../capabilities/contacts/contacts';
import { CONTACT_ENTITY } from './schemas';

type StoredContact = Omit<Contact, 'memo'> & { memoJson?: string | null };

export class RealmContactStore implements ContactStore {
  private revision = 0;
  private listeners = new Set<() => void>();
  constructor(private readonly realm: Realm) {}
  getRevision = () => this.revision;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private notify() {
    this.revision += 1;
    for (const listener of this.listeners) {
      try {
        listener();
      } catch {
        /* Persistence already committed. */
      }
    }
  }
  // v9 records retain their creation network as provenance, not a visibility boundary.
  // Legacy contacts from different networks are kept separately, including conflicts.
  list = (_networkId: string): readonly Contact[] => {
    return Array.from(this.realm.objects(CONTACT_ENTITY))
      .map(object => object as unknown as StoredContact)
      .map(row => {
        let memo: Contact['memo'];
        if (row.memoJson !== null && row.memoJson !== undefined) {
          try {
            memo = validateContactMemo(JSON.parse(row.memoJson) as unknown);
            if (!memo) throw new Error('contact-memo-invalid');
          } catch {
            throw new Error('contact-storage-invalid');
          }
        }
        return Object.freeze({
          id: row.id,
          networkId: row.networkId,
          name: row.name,
          address: row.address,
          ...(memo ? { memo } : {}),
        });
      });
  };
  save = (contact: Contact): void => {
    const memo = validateContactMemo(contact.memo);
    this.realm.write(() => {
      const existing = this.realm.objectForPrimaryKey<StoredContact>(
        CONTACT_ENTITY,
        contact.id,
      ) as unknown as StoredContact | null;
      const identity = contactIdentity(contact.address, memo);
      if (
        this.list(contact.networkId).some(
          row => row.id !== contact.id && contactIdentity(row.address, row.memo) === identity,
        )
      ) {
        throw new Error('contact-duplicate');
      }
      this.realm.create(
        CONTACT_ENTITY,
        {
          id: contact.id,
          // An edit must not rewrite the original network provenance.
          networkId: existing?.networkId ?? contact.networkId,
          name: contact.name,
          address: contact.address,
          memoJson: memo ? JSON.stringify(memo) : null,
        },
        Realm.UpdateMode.Modified,
      );
    });
    this.notify();
  };
  remove = (_networkId: string, id: string): void => {
    this.realm.write(() => {
      const row = this.realm.objectForPrimaryKey<StoredContact>(CONTACT_ENTITY, id);
      if (row) this.realm.delete(row);
    });
    this.notify();
  };
}
