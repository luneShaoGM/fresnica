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
});
