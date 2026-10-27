import { DAPP_CATALOG_CACHE_VERSION, normalizeDappCatalogCache } from '../catalogCache';

const snapshot = {
  schemaVersion: DAPP_CATALOG_CACHE_VERSION,
  networkId: 'stellar-testnet',
  savedAtUnixMs: 123,
  entries: [
    {
      id: 'demo',
      title: 'Demo',
      description: 'Public catalog listing',
      category: 'Tools',
      websiteUrl: 'https://demo.example.org/start',
    },
  ],
};

describe('S14 public dApp catalog snapshot', () => {
  it('keeps only public catalog descriptions, never grants or account identity', () => {
    const normalized = normalizeDappCatalogCache(
      { ...snapshot, grants: [{ accountId: 'private' }], visits: [{ url: 'https://demo.example.org/?token=secret' }] },
      'stellar-testnet',
    );
    expect(normalized).toEqual(snapshot);
    expect(normalized).not.toHaveProperty('grants');
    expect(normalized).not.toHaveProperty('visits');
    expect(normalized).not.toHaveProperty('accountId');
  });

  it('never loads cached listings across network partitions', () => {
    expect(normalizeDappCatalogCache(snapshot, 'stellar-mainnet')).toBeUndefined();
    expect(normalizeDappCatalogCache(snapshot, 'stellar-testnet')).toEqual(snapshot);
  });

  it('fails closed on invalid URL, duplicate id, malformed version, or oversized list', () => {
    expect(
      normalizeDappCatalogCache(
        { ...snapshot, entries: [{ ...snapshot.entries[0], websiteUrl: 'http://demo.example.org/' }] },
        'stellar-testnet',
      ),
    ).toBeUndefined();
    expect(
      normalizeDappCatalogCache(
        { ...snapshot, entries: [{ ...snapshot.entries[0], websiteUrl: 'https://127.0.0.1/' }] },
        'stellar-testnet',
      ),
    ).toBeUndefined();
    expect(
      normalizeDappCatalogCache(
        { ...snapshot, entries: [snapshot.entries[0], snapshot.entries[0]] },
        'stellar-testnet',
      ),
    ).toBeUndefined();
    expect(normalizeDappCatalogCache({ ...snapshot, schemaVersion: 99 }, 'stellar-testnet')).toBeUndefined();
    expect(
      normalizeDappCatalogCache({ ...snapshot, entries: Array(501).fill(snapshot.entries[0]) }, 'stellar-testnet'),
    ).toBeUndefined();
    expect(normalizeDappCatalogCache(null, 'stellar-testnet')).toBeUndefined();
  });
});
