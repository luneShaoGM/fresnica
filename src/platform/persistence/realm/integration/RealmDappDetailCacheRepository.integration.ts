import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Realm from 'realm';

import {
  ACCOUNT_ENTITY,
  DAPP_CATALOG_CACHE_ENTITY,
  DAPP_DETAIL_CACHE_ENTITY,
  PENDING_SUBMISSION_ENTITY,
  TOKEN_METADATA_CACHE_ENTITY,
  WALLET_REALM_SCHEMAS,
} from '../schemas';
import { openWalletRealm } from '../openWalletRealm';
import { RealmDappDetailCacheRepository } from '../RealmDappDetailCacheRepository';

const appId = 'demo.app';
const networkId = 'stellar-mainnet';
const icon = 'https://cdn.example.org/app.png';

describe('Wallet Realm v11 to v12 S14 public dApp details migration', () => {
  afterAll(() => Realm.shutdown());

  it('preserves account, uncertain transaction, directory and token metadata across reopen', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'fresnica-dapp-details-'));
    const path = join(directory, 'wallet.realm');
    let realm: Realm | undefined;
    try {
      realm = await Realm.open({
        path,
        schemaVersion: 11,
        schema: WALLET_REALM_SCHEMAS.filter(item => item.name !== DAPP_DETAIL_CACHE_ENTITY),
      });
      realm.write(() => {
        realm!.create(ACCOUNT_ENTITY, {
          id: 'wallet-keep',
          address: 'G'.padEnd(56, 'A'),
          identityKind: 'classic',
          networkId,
          label: 'Wallet',
          sortOrder: 0,
          hidden: false,
          createdAt: new Date(42_000),
          updatedAt: new Date(42_000),
        });
        realm!.create(PENDING_SUBMISSION_ENTITY, {
          id: 'pending-keep',
          networkId,
          accountId: 'wallet-keep',
          sourceAddress: 'G'.padEnd(56, 'A'),
          transactionHash: 'untouched-hash',
          intentKind: 'send',
          intentKey: 'untouched-intent',
          state: 'uncertain',
          createdAt: new Date(42_000),
          updatedAt: new Date(42_000),
        });
        realm!.create(DAPP_CATALOG_CACHE_ENTITY, {
          networkId,
          schemaVersion: 1,
          savedAt: new Date(42_000),
          payloadJson: '{"schemaVersion":1,"savedAtUnixMs":42000,"networkId":"stellar-mainnet","entries":[]}',
        });
        realm!.create(TOKEN_METADATA_CACHE_ENTITY, {
          id: JSON.stringify([networkId, 'USD', 'G'.padEnd(56, 'B')]),
          networkId,
          code: 'USD',
          issuer: 'G'.padEnd(56, 'B'),
          schemaVersion: 1,
          savedAt: new Date(42_000),
          payloadJson: '{"unchanged":true}',
        });
      });
      realm.close();

      realm = await openWalletRealm({ path });
      expect(realm.schemaVersion).toBe(12);
      expect(realm.objectForPrimaryKey(ACCOUNT_ENTITY, 'wallet-keep')?.label).toBe('Wallet');
      expect(realm.objectForPrimaryKey(PENDING_SUBMISSION_ENTITY, 'pending-keep')?.intentKey).toBe('untouched-intent');
      expect(realm.objectForPrimaryKey(DAPP_CATALOG_CACHE_ENTITY, networkId)?.payloadJson).toContain('"entries":[]');
      expect(realm.objects(TOKEN_METADATA_CACHE_ENTITY)).toHaveLength(1);

      const repository = new RealmDappDetailCacheRepository(realm);
      const snapshot = {
        schemaVersion: 1 as const,
        networkId: 'stellar-mainnet' as const,
        appId,
        savedAtUnixMs: 43_000,
        detail: {
          id: appId,
          title: 'Demo',
          description: 'Overview',
          category: 'Tools',
          websiteUrl: 'https://demo.example.org/',
          longDescription: 'More public details',
          developerName: 'Developer',
          iconUrl: icon,
        },
        iconPreference: { winner: icon, winnerExpiresAt: 44_000, failures: {} },
      };
      repository.replace(snapshot);
      expect(repository.read('stellar-testnet', appId)).toBeUndefined();
      expect(repository.read(networkId, 'OTHER')).toBeUndefined();
      expect(repository.read(networkId, appId)).toEqual(snapshot);
      realm.close();

      realm = await openWalletRealm({ path });
      const reopened = new RealmDappDetailCacheRepository(realm);
      expect(reopened.read(networkId, appId)).toEqual(snapshot);
      realm.write(() => {
        const corrupt = realm!.objectForPrimaryKey(DAPP_DETAIL_CACHE_ENTITY, JSON.stringify([networkId, appId]));
        if (corrupt) corrupt.payloadJson = '{"bad":';
      });
      expect(reopened.read(networkId, appId)).toBeUndefined();
      expect(realm.objectForPrimaryKey(ACCOUNT_ENTITY, 'wallet-keep')?.label).toBe('Wallet');
      expect(realm.objectForPrimaryKey(PENDING_SUBMISSION_ENTITY, 'pending-keep')?.state).toBe('uncertain');
    } finally {
      if (realm && !realm.isClosed) realm.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
