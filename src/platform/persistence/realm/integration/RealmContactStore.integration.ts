import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Realm from 'realm';
import { RealmContactStore } from '../RealmContactStore';
import { openWalletRealm } from '../openWalletRealm';
import { ACCOUNT_ENTITY, CONTACT_ENTITY, WALLET_REALM_SCHEMAS } from '../schemas';

describe('S22 contact migration and persistence', () => {
  afterAll(() => Realm.shutdown());
  it('preserves v8 records, shares contacts globally, rejects duplicate atomically and survives reopen', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'fresnica-contacts-'));
    const path = join(directory, 'wallet.realm');
    let realm: Realm | undefined;
    try {
      realm = await Realm.open({
        path,
        schemaVersion: 8,
        schema: WALLET_REALM_SCHEMAS.filter(schema => schema.name !== CONTACT_ENTITY),
      });
      realm.write(() =>
        realm!.create(ACCOUNT_ENTITY, {
          id: 'old',
          address: 'GOLD',
          identityKind: 'classic',
          networkId: 'test',
          label: 'Old',
          sortOrder: 0,
          hidden: false,
          createdAt: new Date(0),
          updatedAt: new Date(0),
        }),
      );
      realm.close();
      realm = await openWalletRealm({ path });
      expect(realm.schemaVersion).toBe(9);
      expect(realm.objectForPrimaryKey(ACCOUNT_ENTITY, 'old')).toBeTruthy();
      const store = new RealmContactStore(realm);
      const changed = jest.fn();
      store.subscribe(changed);
      const contact = {
        id: '1',
        networkId: 'test',
        name: 'Alice',
        address: 'GDEST',
        memo: { type: 'id' as const, value: '7' },
      };
      store.save(contact);
      store.save({ ...contact, id: '2', memo: { type: 'id', value: '8' } });
      // Identical identities may no longer be added on another network.
      expect(() => store.save({ ...contact, id: 'duplicate-main', networkId: 'main' })).toThrow(
        'contact-duplicate',
      );
      store.save({ ...contact, id: 'main', networkId: 'main', memo: { type: 'id', value: '9' } });
      expect(() => store.save({ ...contact, id: '2', memo: { type: 'id', value: '007' } })).toThrow(
        'contact-duplicate',
      );
      expect(changed).toHaveBeenCalledTimes(3);
      expect(store.list('test').find(row => row.id === '2')?.memo?.value).toBe('8');
      expect(store.list('test').map(row => row.id)).toEqual(store.list('main').map(row => row.id));
      // Editing from a different network preserves the original provenance.
      store.save({ ...contact, networkId: 'main', name: 'Updated' });
      expect(store.list('main').find(row => row.id === '1')).toMatchObject({
        networkId: 'test',
        name: 'Updated',
      });
      realm.close();
      realm = await openWalletRealm({ path });
      const reopened = new RealmContactStore(realm);
      expect(reopened.list('test')).toHaveLength(3);
      expect(reopened.list('main')).toHaveLength(3);
      reopened.remove('main', '1');
      realm.close();
      realm = await openWalletRealm({ path });
      expect(new RealmContactStore(realm).list('test').map(row => row.id)).toEqual(['2', 'main']);
    } finally {
      if (realm && !realm.isClosed) realm.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
  it('preserves pre-existing cross-network duplicates without choosing or overwriting one', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'fresnica-contacts-legacy-'));
    const path = join(directory, 'wallet.realm');
    let realm: Realm | undefined;
    try {
      realm = await openWalletRealm({ path });
      realm.write(() => {
        realm!.create(CONTACT_ENTITY, {
          id: 'main',
          networkId: 'main',
          name: 'Old main label',
          address: 'GDEST',
          memoJson: null,
        });
        realm!.create(CONTACT_ENTITY, {
          id: 'test',
          networkId: 'test',
          name: 'Old test label',
          address: 'GDEST',
          memoJson: null,
        });
      });
      realm.close();
      realm = await openWalletRealm({ path });
      const store = new RealmContactStore(realm);
      expect(store.list('main').map(row => row.id)).toEqual(['main', 'test']);
      expect(store.list('test').map(row => row.id)).toEqual(['main', 'test']);
      expect(() => store.save({ id: 'new', networkId: 'main', name: 'New', address: 'GDEST' })).toThrow(
        'contact-duplicate',
      );
      expect(() => store.save({ id: 'test', networkId: 'main', name: 'Rename', address: 'GDEST' })).toThrow(
        'contact-duplicate',
      );
      expect(store.list('main')).toHaveLength(2);
      store.remove('main', 'test');
      store.save({ id: 'main', networkId: 'test', name: 'Renamed', address: 'GDEST' });
      expect(store.list('test')).toEqual([
        expect.objectContaining({ id: 'main', name: 'Renamed', networkId: 'main' }),
      ]);
    } finally {
      if (realm && !realm.isClosed) realm.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
  it('stores typed Return memo distinctly from Hash across reopen without changing Realm v9', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'fresnica-contact-return-'));
    const path = join(directory, 'wallet.realm');
    let realm: Realm | undefined;
    try {
      realm = await openWalletRealm({ path });
      const store = new RealmContactStore(realm);
      const hex = 'ab'.repeat(32);
      store.save({ id: 'return', networkId: 'test', name: 'Exchange Return', address: 'GDEST',
        memo: { type: 'return', value: hex } });
      store.save({ id: 'hash', networkId: 'main', name: 'Exchange Hash', address: 'GDEST',
        memo: { type: 'hash', value: hex } });
      expect(() => store.save({ id: 'duplicate', networkId: 'main', name: 'Same Return', address: 'GDEST',
        memo: { type: 'return', value: hex.toUpperCase() } })).toThrow('contact-duplicate');
      expect(realm.schemaVersion).toBe(9);
      realm.close();
      realm = await openWalletRealm({ path });
      const reopened = new RealmContactStore(realm);
      expect(reopened.list('test')).toEqual([
        expect.objectContaining({ id: 'return', memo: { type: 'return', value: hex } }),
        expect.objectContaining({ id: 'hash', memo: { type: 'hash', value: hex } }),
      ]);
      expect(reopened.list('main').map(row => row.id)).toEqual(['return', 'hash']);
      expect(realm.schemaVersion).toBe(9);
    } finally {
      if (realm && !realm.isClosed) realm.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('fails closed on corrupt persisted memo shapes without changing or aliasing the record', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'fresnica-contact-corruption-'));
    let realm: Realm | undefined;
    try {
      realm = await openWalletRealm({ path: join(directory, 'wallet.realm') });
      const store = new RealmContactStore(realm);
      const changed = jest.fn();
      store.subscribe(changed);
      for (const memoJson of [
        '{',
        'null',
        '"memo"',
        '{}',
        '{"type":"return","value":"ab"}',
        '{"type":"id","value":7}',
        '{"type":"id","value":"18446744073709551616"}',
        '{"type":"hash","value":"ab"}',
        '{"type":"text","value":""}',
        '',
      ]) {
        realm.write(() => {
          realm!.delete(realm!.objects(CONTACT_ENTITY));
          realm!.create(CONTACT_ENTITY, {
            id: 'bad',
            networkId: 'test',
            name: 'Exchange',
            address: 'GDEST',
            memoJson,
          });
        });
        expect(() => store.list('test')).toThrow('contact-storage-invalid');
        expect(() => store.save({ id: 'good', networkId: 'test', name: 'Good', address: 'GOTHER' })).toThrow(
          'contact-storage-invalid',
        );
        expect(realm.objects(CONTACT_ENTITY)).toHaveLength(1);
        expect(realm.objectForPrimaryKey<{ id: string; memoJson: string }>(CONTACT_ENTITY, 'bad')?.memoJson).toBe(
          memoJson,
        );
        expect(changed).not.toHaveBeenCalled();
      }
    } finally {
      if (realm && !realm.isClosed) realm.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
  it('fails closed on corrupt global contact data without deleting legacy records', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'fresnica-contact-partition-'));
    const path = join(directory, 'wallet.realm');
    let realm: Realm | undefined;
    try {
      realm = await openWalletRealm({ path });
      realm.write(() =>
        realm!.create(CONTACT_ENTITY, {
          id: 'bad-main',
          networkId: 'main',
          name: 'Broken',
          address: 'GDEST',
          memoJson: '{',
        }),
      );
      const store = new RealmContactStore(realm);
      expect(() => store.list('test')).toThrow('contact-storage-invalid');
      expect(() => store.save({ id: 'plain', networkId: 'test', name: 'Plain', address: 'GDEST' })).toThrow(
        'contact-storage-invalid',
      );
      expect(realm.objectForPrimaryKey(CONTACT_ENTITY, 'bad-main')).toBeTruthy();
    } finally {
      if (realm && !realm.isClosed) realm.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
