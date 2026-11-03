import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Realm from 'realm';
import { RealmContactStore } from '../RealmContactStore';
import { openWalletRealm } from '../openWalletRealm';
import { ACCOUNT_ENTITY, CONTACT_ENTITY, WALLET_REALM_SCHEMAS } from '../schemas';

describe('S22 contact migration and persistence', () => {
  afterAll(() => Realm.shutdown());
  it('preserves v8 records, isolates networks, rejects duplicate atomically and survives reopen', async () => {
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
      store.save({ ...contact, id: 'main', networkId: 'main' });
      expect(() => store.save({ ...contact, id: '2', memo: { type: 'id', value: '007' } })).toThrow(
        'contact-duplicate',
      );
      expect(changed).toHaveBeenCalledTimes(3);
      expect(store.list('test').find(row => row.id === '2')?.memo?.value).toBe('8');
      expect(() => store.remove('main', '1')).toThrow('contact-network-mismatch');
      expect(() => store.save({ ...contact, networkId: 'main' })).toThrow('contact-network-mismatch');
      realm.close();
      realm = await openWalletRealm({ path });
      const reopened = new RealmContactStore(realm);
      expect(reopened.list('test')).toHaveLength(2);
      expect(reopened.list('main')).toHaveLength(1);
      reopened.remove('test', '1');
      realm.close();
      realm = await openWalletRealm({ path });
      expect(new RealmContactStore(realm).list('test').map(row => row.id)).toEqual(['2']);
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
  it('decodes only the requested network and preserves exact canonical memo identity across reopen', async () => {
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
      expect(store.list('test')).toEqual([]);
      store.save({ id: 'plain', networkId: 'test', name: 'Plain', address: 'GDEST' });
      store.save({ id: 'memo', networkId: 'test', name: 'Memo', address: 'GDEST', memo: { type: 'id', value: '007' } });
      expect(() => store.list('main')).toThrow('contact-storage-invalid');
      realm.close();
      realm = await openWalletRealm({ path });
      const reopened = new RealmContactStore(realm);
      expect(reopened.list('test').find(row => row.id === 'memo')?.memo).toEqual({ type: 'id', value: '7' });
      expect(reopened.list('test').find(row => row.id === 'plain')?.memo).toBeUndefined();
      expect(() =>
        reopened.save({
          id: 'duplicate',
          networkId: 'test',
          name: 'Dup',
          address: 'GDEST',
          memo: { type: 'id', value: '7' },
        }),
      ).toThrow('contact-duplicate');
      expect(reopened.list('test')).toHaveLength(2);
      expect(realm.objectForPrimaryKey(CONTACT_ENTITY, 'bad-main')).toBeTruthy();
    } finally {
      if (realm && !realm.isClosed) realm.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
