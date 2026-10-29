import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import Realm from 'realm';

import { RealmAccountSignerRepository } from '../RealmAccountSignerRepository';
import { RealmDappPermissionStore } from '../RealmDappPermissionStore';
import { openWalletRealm } from '../openWalletRealm';
import { ACCOUNT_ENTITY, DAPP_PERMISSION_GRANT_ENTITY, WALLET_REALM_SCHEMAS } from '../schemas';

describe('S17 Realm v8 persisted authorization', () => {
  afterAll(() => Realm.shutdown());

  it('migrates v7 to v8 without losing an account; scope and revocation survive restart', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'fresnica-dapp-permission-v8-'));
    const path = join(directory, 'wallet.realm');
    let realm: Realm | undefined;
    const testnet = {
      origin: 'https://dex.example.org',
      accountId: 'wallet-1',
      networkId: 'stellar-testnet',
    };
    try {
      realm = await Realm.open({
        path,
        schemaVersion: 7,
        schema: WALLET_REALM_SCHEMAS.filter(schema => schema.name !== DAPP_PERMISSION_GRANT_ENTITY),
      });
      realm.write(() => {
        realm!.create(ACCOUNT_ENTITY, {
          id: 'wallet-1',
          address: 'GTEST',
          identityKind: 'classic',
          networkId: 'stellar-testnet',
          label: 'Old wallet',
          sortOrder: 0,
          hidden: false,
          createdAt: new Date(0),
          updatedAt: new Date(0),
        });
      });
      realm.close();
      realm = await openWalletRealm({ path });
      expect(realm.schemaVersion).toBe(8);
      expect(new RealmAccountSignerRepository(realm).getAccount('wallet-1')?.label).toBe('Old wallet');
      const store = new RealmDappPermissionStore(realm);
      expect(store.has(testnet)).toBe(false);
      store.grant(testnet);
      store.grant({ ...testnet, accountId: 'wallet-2' });
      store.grant({ ...testnet, networkId: 'stellar-mainnet' });
      store.close();
      realm.close();

      realm = await openWalletRealm({ path });
      const restarted = new RealmDappPermissionStore(realm);
      expect(restarted.has(testnet)).toBe(true);
      expect(restarted.has({ ...testnet, origin: 'https://evil.example.org' })).toBe(false);
      expect(restarted.list('stellar-testnet')).toHaveLength(2);
      expect(restarted.list('stellar-mainnet')).toHaveLength(1);
      restarted.revoke(testnet);
      expect(restarted.has(testnet)).toBe(false);
      expect(restarted.has({ ...testnet, accountId: 'wallet-2' })).toBe(true);
      restarted.close();
      realm.close();

      realm = await openWalletRealm({ path });
      const final = new RealmDappPermissionStore(realm);
      expect(final.has(testnet)).toBe(false);
      expect(final.has({ ...testnet, accountId: 'wallet-2' })).toBe(true);
      expect(final.list('stellar-mainnet')).toHaveLength(1);
      expect(new RealmAccountSignerRepository(realm).getAccount('wallet-1')?.label).toBe('Old wallet');
      final.close();
    } finally {
      if (realm && !realm.isClosed) realm.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
