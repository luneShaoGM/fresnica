import type Realm from 'realm';
import { RealmCuratedSourceCacheRepository } from '../RealmCuratedSourceCacheRepository';
import { CURATED_ASSET_SOURCE_CACHE_ENTITY } from '../schemas';

const issuer = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';
const snapshot = {
  schemaVersion: 1 as const,
  networkId: 'stellar-mainnet',
  sourceId: 'lobstr' as const,
  savedAtUnixMs: 30_000,
  assets: [{ code: 'Usd', issuer }],
};

function fakeRealm() {
  const records = new Map<string, Record<string, unknown>>();
  const realm = {
    objectForPrimaryKey: (entity: string, id: string) =>
      entity === CURATED_ASSET_SOURCE_CACHE_ENTITY ? (records.get(id) ?? null) : null,
    write: (fn: () => void) => fn(),
    delete: (existing: Record<string, unknown>) => {
      for (const [key, value] of records) if (value === existing) records.delete(key);
    },
    create: (entity: string, record: Record<string, unknown>) => {
      if (entity !== CURATED_ASSET_SOURCE_CACHE_ENTITY) throw new Error('wrong-entity');
      records.set(record.id as string, record);
    },
  };
  return { realm: realm as unknown as Realm, records };
}

describe('Realm public curated asset source cache', () => {
  it('stores exact Mainnet source partitions, overwriting only that source', () => {
    const fake = fakeRealm();
    const repo = new RealmCuratedSourceCacheRepository(fake.realm);
    repo.replace(snapshot);
    repo.replace({ ...snapshot, sourceId: 'soroswap', assets: [{ code: 'USD', issuer }] });
    expect(repo.read('stellar-mainnet', 'lobstr')?.assets).toEqual(snapshot.assets);
    expect(repo.read('stellar-mainnet', 'soroswap')?.assets).toEqual([{ code: 'USD', issuer }]);
    expect(repo.read('stellar-testnet', 'lobstr')).toBeUndefined();
    repo.replace({ ...snapshot, assets: [{ code: 'BTC', issuer }] });
    expect(repo.read('stellar-mainnet', 'lobstr')?.assets).toEqual([{ code: 'BTC', issuer }]);
    expect(repo.read('stellar-mainnet', 'soroswap')?.assets).toEqual([{ code: 'USD', issuer }]);
    expect(fake.records.size).toBe(2);
  });

  it('ignores corrupt or wrong-source snapshots without poisoning another partition', () => {
    const fake = fakeRealm();
    const repo = new RealmCuratedSourceCacheRepository(fake.realm);
    repo.replace(snapshot);
    repo.replace({ ...snapshot, sourceId: 'soroswap' });
    const id = JSON.stringify(['stellar-mainnet', 'lobstr']);
    fake.records.get(id)!.payloadJson = '{"invalid":true}';
    expect(repo.read('stellar-mainnet', 'lobstr')).toBeUndefined();
    expect(repo.read('stellar-mainnet', 'soroswap')?.assets).toEqual(snapshot.assets);
    expect(() => repo.replace({ ...snapshot, networkId: 'stellar-testnet' })).toThrow('curated-source-cache-invalid');
    expect(fake.records.size).toBe(2);
  });
});
