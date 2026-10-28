import type Realm from 'realm';

import { RealmDappCatalogRepository } from '../RealmDappCatalogRepository';
import { DAPP_CATALOG_CACHE_ENTITY } from '../schemas';

function fakeRealm() {
  const records = new Map<string, Record<string, unknown>>();
  const key = (entity: string, networkId: string) => JSON.stringify([entity, networkId]);
  const realm = {
    objectForPrimaryKey: (entity: string, networkId: string) => records.get(key(entity, networkId)) ?? null,
    write: (callback: () => void) => callback(),
    delete: (existing: Record<string, unknown>) => {
      for (const [id, value] of records) if (value === existing) records.delete(id);
    },
    create: (entity: string, record: Record<string, unknown>) => {
      records.set(key(entity, record.networkId as string), record);
    },
  };
  return { records, realm: realm as unknown as Realm, key };
}

const catalog = {
  schemaVersion: 1 as const,
  networkId: 'stellar-testnet',
  savedAtUnixMs: 20,
  entries: [
    { id: 'demo', title: 'Demo', description: 'Public', category: 'Tools', websiteUrl: 'https://demo.example.org/' },
  ],
};

describe('Realm public dApp catalog repository', () => {
  it('round trips public cache and keeps unrelated network records', () => {
    const fake = fakeRealm();
    const repo = new RealmDappCatalogRepository(fake.realm);
    repo.replace(catalog);
    expect(repo.read('stellar-testnet')).toEqual(catalog);
    expect(repo.read('stellar-mainnet')).toBeUndefined();
    expect(fake.records.get(fake.key(DAPP_CATALOG_CACHE_ENTITY, 'stellar-testnet'))?.payloadJson).not.toContain(
      'grants',
    );
    repo.replace({ ...catalog, networkId: 'stellar-mainnet' });
    expect(repo.read('stellar-mainnet')?.entries[0].id).toBe('demo');
    expect(repo.read('stellar-testnet')).toEqual(catalog);
  });

  it('discards corrupt values on read without deleting the account or other partitions', () => {
    const fake = fakeRealm();
    const repo = new RealmDappCatalogRepository(fake.realm);
    repo.replace(catalog);
    const id = fake.key(DAPP_CATALOG_CACHE_ENTITY, 'stellar-testnet');
    fake.records.set(id, { networkId: 'stellar-testnet', schemaVersion: 1, payloadJson: '{broken' });
    expect(repo.read('stellar-testnet')).toBeUndefined();
    expect(fake.records.has(id)).toBe(true);
    repo.replace(catalog);
    expect(repo.read('stellar-testnet')).toEqual(catalog);
  });

  it('refuses invalid cached URLs instead of persisting them', () => {
    const repo = new RealmDappCatalogRepository(fakeRealm().realm);
    expect(() =>
      repo.replace({
        ...catalog,
        entries: [{ ...catalog.entries[0], websiteUrl: 'https://127.0.0.1' }],
      }),
    ).toThrow('dapp-catalog-cache-invalid');
  });
});
