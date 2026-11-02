import Realm from 'realm';

import { contactIdentity, type Contact, type ContactStore } from '../../../capabilities/contacts/contacts';
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
  list = (networkId: string): readonly Contact[] => {
    return Array.from(this.realm.objects(CONTACT_ENTITY))
      .map(object => {
        const row = object as unknown as StoredContact;
        return Object.freeze({
          id: row.id,
          networkId: row.networkId,
          name: row.name,
          address: row.address,
          ...(row.memoJson ? { memo: JSON.parse(row.memoJson) as Contact['memo'] } : {}),
        });
      })
      .filter(row => row.networkId === networkId);
  };
  save = (contact: Contact): void => {
    this.realm.write(() => {
      const existing = this.realm.objectForPrimaryKey<StoredContact>(CONTACT_ENTITY, contact.id) as unknown as StoredContact | null;
      if (existing && existing.networkId !== contact.networkId) throw new Error('contact-network-mismatch');
      const identity = contactIdentity(contact.address, contact.memo);
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
          networkId: contact.networkId,
          name: contact.name,
          address: contact.address,
          memoJson: contact.memo ? JSON.stringify(contact.memo) : null,
        },
        Realm.UpdateMode.Modified,
      );
    });
    this.notify();
  };
  remove = (networkId: string, id: string): void => {
    this.realm.write(() => {
      const row = this.realm.objectForPrimaryKey<StoredContact>(CONTACT_ENTITY, id);
      if (row && (row as unknown as StoredContact).networkId !== networkId) throw new Error('contact-network-mismatch');
      if (row) this.realm.delete(row);
    });
    this.notify();
  };
}
