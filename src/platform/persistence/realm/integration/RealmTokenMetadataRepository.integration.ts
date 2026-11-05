import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Realm from 'realm';

import { openWalletRealm } from '../openWalletRealm';
import { RealmTokenMetadataRepository } from '../RealmTokenMetadataRepository';
import {
  ACCOUNT_ENTITY,
  BALANCE_CACHE_SNAPSHOT_ENTITY,
  CURATED_ASSET_SOURCE_CACHE_ENTITY,
  DAPP_CATALOG_CACHE_ENTITY,
  HISTORY_CACHE_SNAPSHOT_ENTITY,
  PENDING_SUBMISSION_ENTITY,
  TOKEN_METADATA_CACHE_ENTITY,
  DAPP_DETAIL_CACHE_ENTITY,
  WALLET_REALM_SCHEMAS,
} from '../schemas';

const issuer = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';
const imageURL = 'https://cdn.example.org/USD.png';

describe('Wallet Realm v10 to v11 token display metadata integration', () => {
  afterAll(() => Realm.shutdown());

  it('migrates and reopens without altering wallet/recovery or existing curated partitions', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'fresnica-token-metadata-migration-'));
    const path = join(directory, 'wallet.realm');
    let realm: Realm | undefined;
    try {
      realm = await Realm.open({
        path,
        schemaVersion: 10,
        schema: WALLET_REALM_SCHEMAS.filter(
          item => item.name !== TOKEN_METADATA_CACHE_ENTITY && item.name !== DAPP_DETAIL_CACHE_ENTITY,
        ),
      });
      const savedAt = new Date(30000);
      realm.write(() => {
        realm!.create(ACCOUNT_ENTITY, {
          id: 'account-legacy',
          address: issuer,
          identityKind: 'classic',
          networkId: 'stellar-mainnet',
          label: 'Preserve account',
          sortOrder: 0,
          hidden: false,
          createdAt: savedAt,
          updatedAt: savedAt,
        });
        realm!.create(PENDING_SUBMISSION_ENTITY, {
          id: 'uncertain-legacy',
          networkId: 'stellar-mainnet',
          accountId: 'account-legacy',
          sourceAddress: issuer,
          transactionHash: 'original-transaction',
          intentKind: 'send',
          intentKey: 'original-intent',
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
          balanceJson: '{"balance":"unchanged"}',
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
          payloadJson: '{"id":"old-directory"}',
        });
        const source = {
          schemaVersion: 1,
          networkId: 'stellar-mainnet',
          sourceId: 'lobstr',
          savedAtUnixMs: 30000,
          assets: [{ code: 'Usd', issuer }],
        };
        realm!.create(CURATED_ASSET_SOURCE_CACHE_ENTITY, {
          id: JSON.stringify(['stellar-mainnet', 'lobstr']),
          networkId: 'stellar-mainnet',
          sourceId: 'lobstr',
          schemaVersion: 1,
          savedAt,
          payloadJson: JSON.stringify(source),
        });
      });
      realm.close();

      realm = await openWalletRealm({ path });
      expect(realm.schemaVersion).toBe(12);
      expect(realm.objectForPrimaryKey(ACCOUNT_ENTITY, 'account-legacy')?.label).toBe('Preserve account');
      expect(realm.objectForPrimaryKey(PENDING_SUBMISSION_ENTITY, 'uncertain-legacy')?.state).toBe('uncertain');
      expect(realm.objectForPrimaryKey(BALANCE_CACHE_SNAPSHOT_ENTITY, 'balance-preserved')?.balanceJson).toBe(
        '{"balance":"unchanged"}',
      );
      expect(realm.objectForPrimaryKey(HISTORY_CACHE_SNAPSHOT_ENTITY, 'history-preserved')?.detailsJson).toBe('[]');
      expect(realm.objectForPrimaryKey(DAPP_CATALOG_CACHE_ENTITY, 'stellar-mainnet')?.payloadJson).toBe(
        '{"id":"old-directory"}',
      );
      expect(
        realm.objectForPrimaryKey(CURATED_ASSET_SOURCE_CACHE_ENTITY, JSON.stringify(['stellar-mainnet', 'lobstr']))
          ?.sourceId,
      ).toBe('lobstr');

      const repo = new RealmTokenMetadataRepository(realm);
      const snapshot = {
        schemaVersion: 1 as const,
        networkId: 'stellar-mainnet' as const,
        code: 'Usd',
        issuer,
        savedAtUnixMs: 30_000,
        metadata: { source: 'curated' as const, icons: [imageURL], name: 'USD' },
      };
      repo.replace(snapshot);
      expect(repo.read('stellar-testnet', 'Usd', issuer)).toBeUndefined();
      expect(repo.read('stellar-mainnet', 'USD', issuer)).toBeUndefined();
      expect(repo.read('stellar-mainnet', 'Usd', issuer)).toEqual(snapshot);
      realm.close();

      realm = await openWalletRealm({ path });
      const reopened = new RealmTokenMetadataRepository(realm);
      expect(reopened.read('stellar-mainnet', 'Usd', issuer)).toEqual(snapshot);
      realm.write(() => {
        const record = realm!.objectForPrimaryKey(
          TOKEN_METADATA_CACHE_ENTITY,
          JSON.stringify(['stellar-mainnet', 'Usd', issuer]),
        );
        if (record) record.payloadJson = '{corrupt-json';
      });
      expect(reopened.read('stellar-mainnet', 'Usd', issuer)).toBeUndefined();
      expect(realm.objectForPrimaryKey(PENDING_SUBMISSION_ENTITY, 'uncertain-legacy')?.intentKey).toBe(
        'original-intent',
      );
      expect(realm.objectForPrimaryKey(ACCOUNT_ENTITY, 'account-legacy')?.label).toBe('Preserve account');
    } finally {
      if (realm && !realm.isClosed) realm.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
