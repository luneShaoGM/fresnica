import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Realm from 'realm';

import { RealmCuratedSourceCacheRepository } from '../RealmCuratedSourceCacheRepository';
import { createCachedAssetCatalog } from '../../../assets/CachedAssetCatalog';
import { CURATED_CACHE_TTL_MS } from '../../../../capabilities/trustline/curatedSourceCache';
import { openWalletRealm } from '../openWalletRealm';
import {
  ACCOUNT_ENTITY,
  BALANCE_CACHE_SNAPSHOT_ENTITY,
  CURATED_ASSET_SOURCE_CACHE_ENTITY,
  TOKEN_METADATA_CACHE_ENTITY,
  DAPP_CATALOG_CACHE_ENTITY,
  HISTORY_CACHE_SNAPSHOT_ENTITY,
  PENDING_SUBMISSION_ENTITY,
  WALLET_REALM_SCHEMAS,
} from '../schemas';

const issuer = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';

describe('Realm v9 to v10 curated asset cache integration', () => {
  afterAll(() => Realm.shutdown());

  it('preserves account, pending, balance, history and dApp records through migration and cache reopen', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'fresnica-s06-curated-cache-'));
    const path = join(directory, 'wallet.realm');
    let realm: Realm | undefined;
    try {
      realm = await Realm.open({
        path,
        schemaVersion: 9,
        schema: WALLET_REALM_SCHEMAS.filter(
          item => item.name !== CURATED_ASSET_SOURCE_CACHE_ENTITY && item.name !== TOKEN_METADATA_CACHE_ENTITY,
        ),
      });
      const savedAt = new Date(10000);
      realm.write(() => {
        realm!.create(ACCOUNT_ENTITY, {
          id: 'legacy',
          address: issuer,
          identityKind: 'classic',
          networkId: 'stellar-mainnet',
          label: 'Keep wallet',
          sortOrder: 0,
          hidden: false,
          createdAt: savedAt,
          updatedAt: savedAt,
        });
        realm!.create(PENDING_SUBMISSION_ENTITY, {
          id: 'pending-1',
          networkId: 'stellar-mainnet',
          accountId: 'legacy',
          sourceAddress: issuer,
          transactionHash: 'hash-unchanged',
          intentKind: 'send',
          intentKey: 'intent-unchanged',
          state: 'uncertain',
          createdAt: savedAt,
          updatedAt: savedAt,
        });
        realm!.create(BALANCE_CACHE_SNAPSHOT_ENTITY, {
          id: 'balance-preserved',
          networkId: 'stellar-mainnet',
          accountAddress: issuer,
          schemaVersion: 1,
          lastSuccessfulUpdateAt: savedAt,
          balanceJson: '{"status":"inactive","address":"kept"}',
        });
        realm!.create(HISTORY_CACHE_SNAPSHOT_ENTITY, {
          id: 'history-preserved',
          networkId: 'stellar-mainnet',
          accountAddress: issuer,
          schemaVersion: 1,
          lastSuccessfulHorizonUpdateAt: savedAt,
          entriesJson: '[]',
          detailsJson: '[]',
        });
        realm!.create(DAPP_CATALOG_CACHE_ENTITY, {
          networkId: 'stellar-mainnet',
          schemaVersion: 1,
          savedAt,
          payloadJson: '{"old":"catalog"}',
        });
      });
      realm.close();

      realm = await openWalletRealm({ path });
      expect(realm.schemaVersion).toBe(11);
      expect(realm.objectForPrimaryKey(ACCOUNT_ENTITY, 'legacy')?.label).toBe('Keep wallet');
      expect(realm.objectForPrimaryKey(PENDING_SUBMISSION_ENTITY, 'pending-1')?.transactionHash).toBe('hash-unchanged');
      expect(realm.objectForPrimaryKey(BALANCE_CACHE_SNAPSHOT_ENTITY, 'balance-preserved')?.balanceJson).toBe(
        '{"status":"inactive","address":"kept"}',
      );
      expect(realm.objectForPrimaryKey(HISTORY_CACHE_SNAPSHOT_ENTITY, 'history-preserved')?.entriesJson).toBe('[]');
      expect(realm.objectForPrimaryKey(DAPP_CATALOG_CACHE_ENTITY, 'stellar-mainnet')?.payloadJson).toBe(
        '{"old":"catalog"}',
      );

      const cache = new RealmCuratedSourceCacheRepository(realm);
      const item = {
        schemaVersion: 1 as const,
        networkId: 'stellar-mainnet',
        sourceId: 'lobstr' as const,
        savedAtUnixMs: 10_000,
        assets: [{ code: 'usd', issuer }],
      };
      cache.replace(item);
      cache.replace({ ...item, sourceId: 'soroswap', assets: [{ code: 'USD', issuer }] });
      realm.close();

      realm = await openWalletRealm({ path });
      const reopened = new RealmCuratedSourceCacheRepository(realm);
      expect(reopened.read('stellar-mainnet', 'lobstr')?.assets).toEqual(item.assets);
      expect(reopened.read('stellar-mainnet', 'soroswap')?.assets).toEqual([{ code: 'USD', issuer }]);
      expect(reopened.read('stellar-testnet', 'lobstr')).toBeUndefined();
      const offlineRead = jest.fn(async () => {
        throw new Error('offline');
      });
      const reopenedCatalog = createCachedAssetCatalog({
        networkId: 'stellar-mainnet',
        cache: reopened,
        http: { read: offlineRead },
        now: () => 10_000 + CURATED_CACHE_TTL_MS,
      });
      expect(reopenedCatalog.readCachedSource('stellar-mainnet', 'lobstr')?.stale).toBe(true);
      await expect(
        reopenedCatalog.loadSource('stellar-mainnet', 'lobstr', new AbortController().signal),
      ).resolves.toMatchObject({
        assets: item.assets,
        fromCache: true,
        stale: true,
        refreshFailed: true,
      });
      expect(offlineRead).toHaveBeenCalledTimes(1);
      reopenedCatalog.close();

      realm.write(() => {
        const record = realm!.objectForPrimaryKey(
          CURATED_ASSET_SOURCE_CACHE_ENTITY,
          JSON.stringify(['stellar-mainnet', 'lobstr']),
        );
        if (record) record.payloadJson = '{corrupt';
      });
      expect(reopened.read('stellar-mainnet', 'lobstr')).toBeUndefined();
      expect(reopened.read('stellar-mainnet', 'soroswap')?.assets).toEqual([{ code: 'USD', issuer }]);
      expect(realm.objectForPrimaryKey(PENDING_SUBMISSION_ENTITY, 'pending-1')?.state).toBe('uncertain');
      expect(realm.objectForPrimaryKey(ACCOUNT_ENTITY, 'legacy')?.label).toBe('Keep wallet');
    } finally {
      if (realm && !realm.isClosed) realm.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
