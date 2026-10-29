import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import Realm from 'realm';

import { createFchainCatalog } from '../../../dapps/loadFchainCatalog';

import { RealmAccountSignerRepository } from '../RealmAccountSignerRepository';
import { RealmDappCatalogRepository } from '../RealmDappCatalogRepository';
import { openWalletRealm } from '../openWalletRealm';
import { ACCOUNT_ENTITY, DAPP_CATALOG_CACHE_ENTITY, WALLET_REALM_SCHEMAS } from '../schemas';

const testnetCatalog = {
  schemaVersion: 1 as const,
  networkId: 'stellar-testnet',
  savedAtUnixMs: 123,
  entries: [
    {
      id: 'testnet',
      title: 'Testnet',
      description: 'Public catalog',
      category: 'Tools',
      websiteUrl: 'https://test.example.org/',
    },
  ],
};

describe('Realm S14 public catalog integration', () => {
  afterAll(() => Realm.shutdown());

  it('keeps the prior on-disk snapshot after malformed HTTP catalog and hydrates it offline on reopen', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'fresnica-dapp-catalog-malformed-'));
    const path = join(directory, 'wallet.realm');
    let realm: Realm | undefined;
    try {
      realm = await openWalletRealm({ path });
      const cache = new RealmDappCatalogRepository(realm);
      cache.replace(testnetCatalog);
      const catalog = createFchainCatalog({
        cache,
        networkId: 'stellar-testnet',
        fetchImpl: jest.fn(
          async () =>
            new Response(JSON.stringify({ schemaVersion: 1, all: [{ stage: 'production' }] }), { status: 200 }),
        ) as unknown as typeof fetch,
      });
      await expect(catalog.load()).resolves.toMatchObject({ kind: 'ready', stale: true, entries: [{ id: 'testnet' }] });
      expect(cache.read('stellar-testnet')).toEqual(testnetCatalog);
      realm.close();

      realm = await openWalletRealm({ path });
      const fetchImpl = jest.fn();
      const reopened = createFchainCatalog({
        cache: new RealmDappCatalogRepository(realm),
        networkId: 'stellar-testnet',
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });
      expect(reopened.readCached()).toEqual({
        kind: 'ready',
        entries: testnetCatalog.entries,
        stale: true,
      });
      expect(fetchImpl).not.toHaveBeenCalled();
    } finally {
      if (realm && !realm.isClosed) realm.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('migrates v6 to v8, preserves an existing account and persists per-network cache across restart', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'fresnica-dapp-catalog-'));
    const path = join(directory, 'wallet.realm');
    let realm: Realm | undefined;
    try {
      realm = await Realm.open({
        path,
        schemaVersion: 6,
        schema: WALLET_REALM_SCHEMAS.filter(schema => schema.name !== DAPP_CATALOG_CACHE_ENTITY),
      });
      const date = new Date(0);
      realm.write(() => {
        realm!.create(ACCOUNT_ENTITY, {
          id: 'old-account',
          address: 'GTEST',
          identityKind: 'classic',
          networkId: 'stellar-testnet',
          label: 'Existing',
          sortOrder: 0,
          hidden: false,
          createdAt: date,
          updatedAt: date,
        });
      });
      realm.close();

      realm = await openWalletRealm({ path });
      expect(realm.schemaVersion).toBe(8);
      expect(new RealmAccountSignerRepository(realm).getAccount('old-account')?.label).toBe('Existing');
      const cache = new RealmDappCatalogRepository(realm);
      expect(cache.read('stellar-testnet')).toBeUndefined();
      cache.replace(testnetCatalog);
      cache.replace({
        ...testnetCatalog,
        networkId: 'stellar-mainnet',
        entries: [{ ...testnetCatalog.entries[0], id: 'main', websiteUrl: 'https://main.example.org/' }],
      });
      const failedWrite = jest.spyOn(realm, 'create').mockImplementationOnce(() => {
        throw new Error('catalog-write-failed');
      });
      try {
        expect(() =>
          cache.replace({
            ...testnetCatalog,
            entries: [{ ...testnetCatalog.entries[0], title: 'Should not persist' }],
          }),
        ).toThrow('catalog-write-failed');
      } finally {
        failedWrite.mockRestore();
      }
      expect(cache.read('stellar-testnet')).toEqual(testnetCatalog);

      realm.close();

      realm = await openWalletRealm({ path });
      const reopened = new RealmDappCatalogRepository(realm);
      expect(reopened.read('stellar-testnet')).toEqual(testnetCatalog);
      expect(reopened.read('stellar-mainnet')?.entries[0].id).toBe('main');
      expect(new RealmAccountSignerRepository(realm).getAccount('old-account')?.label).toBe('Existing');

      realm.write(() => {
        const item = realm!.objectForPrimaryKey(DAPP_CATALOG_CACHE_ENTITY, 'stellar-testnet');
        if (item) item.payloadJson = '{broken';
      });
      expect(reopened.read('stellar-testnet')).toBeUndefined();
      expect(reopened.read('stellar-mainnet')?.entries[0].id).toBe('main');
      expect(new RealmAccountSignerRepository(realm).getAccount('old-account')?.label).toBe('Existing');
    } finally {
      if (realm && !realm.isClosed) realm.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
