import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Realm from 'realm';
import { createDappRecentHistory } from '../../../../capabilities/dapp-interaction/dappRecentHistory';
import { RealmDappRecentRepository } from '../RealmDappRecentRepository';
import { RealmAccountSignerRepository } from '../RealmAccountSignerRepository';
import { openWalletRealm } from '../openWalletRealm';
import { ACCOUNT_ENTITY, DAPP_RECENT_ENTITY, WALLET_REALM_SCHEMAS } from '../schemas';

describe('Recent origins on disk', () => {
  afterAll(() => Realm.shutdown());
  it('migrates v13, preserves accounts, reopens isolated histories and rolls back failed writes', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'fresnica-recent-'));
    const path = join(directory, 'wallet.realm');
    let realm: Realm | undefined;
    try {
      realm = await Realm.open({
        path,
        schemaVersion: 13,
        schema: WALLET_REALM_SCHEMAS.filter(schema => schema.name !== DAPP_RECENT_ENTITY),
      });
      realm.write(() =>
        realm!.create(ACCOUNT_ENTITY, {
          id: 'old',
          address: 'GOLD',
          identityKind: 'classic',
          networkId: 'stellar-testnet',
          label: 'Existing',
          sortOrder: 0,
          hidden: false,
          createdAt: new Date(0),
          updatedAt: new Date(0),
        }),
      );
      realm.close();
      realm = await openWalletRealm({ path });
      expect(realm.schemaVersion).toBe(14);
      const repository = new RealmDappRecentRepository(realm);
      const history = createDappRecentHistory(repository, 'stellar-testnet');
      history.record('https://dex.example.org/app?secret=private-value');
      repository.replace('stellar-mainnet', ['https://main.example.org']);
      expect(repository.read('stellar-testnet')).toEqual(['https://dex.example.org']);
      expect(String(realm.objectForPrimaryKey(DAPP_RECENT_ENTITY, 'stellar-testnet')?.originsJson)).not.toContain(
        'private-value',
      );
      const create = jest.spyOn(realm, 'create').mockImplementationOnce(() => {
        throw new Error('disk-failed');
      });
      history.record('https://unsaved.example.org');
      create.mockRestore();
      expect(history.getSnapshot()).toEqual({ origins: ['https://dex.example.org'], unavailable: true });
      expect(repository.read('stellar-testnet')).toEqual(['https://dex.example.org']);
      history.close();
      realm.close();
      realm = await openWalletRealm({ path });
      const reopened = new RealmDappRecentRepository(realm);
      expect(createDappRecentHistory(reopened, 'stellar-testnet').getSnapshot()).toEqual({
        origins: ['https://dex.example.org'],
        unavailable: false,
      });
      expect(reopened.read('stellar-mainnet')).toEqual(['https://main.example.org']);
      expect(new RealmAccountSignerRepository(realm).getAccount('old')?.label).toBe('Existing');
      for (const payload of [
        '{broken',
        '["https://unsafe.example.org/path?secret=x"]',
        '["https://u:p@example.org"]',
      ]) {
        realm.write(() => {
          realm!.objectForPrimaryKey(DAPP_RECENT_ENTITY, 'stellar-testnet')!.originsJson = payload;
        });
        expect(reopened.read('stellar-testnet')).toEqual([]);
        expect(reopened.read('stellar-mainnet')).toEqual(['https://main.example.org']);
      }
      reopened.replace('stellar-testnet', ['https://recovered.example.org']);
      expect(reopened.read('stellar-testnet')).toEqual(['https://recovered.example.org']);
    } finally {
      if (realm && !realm.isClosed) realm.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
