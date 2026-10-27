import {
  normalizeDappCatalogCache,
  type DappCatalogCacheRepository,
  type DappCatalogCacheSnapshot,
} from '../../../capabilities/dapp-catalog/catalogCache';
import { catalogEntriesFromFchain, createFchainCatalog } from '../loadFchainCatalog';

const payload = {
  schemaVersion: 1,
  revision: 'rev-1',
  all: [
    {
      identifier: 'demo',
      name: 'Demo',
      shortDescription: 'A public listing',
      primaryCategory: 'Tools',
      stage: 'production',
      launchUrls: { testnet: 'https://demo.example.org/app', mainnet: 'https://demo.example.org/main' },
    },
    {
      identifier: 'main-only',
      name: 'Main',
      shortDescription: 'Only on mainnet',
      primaryCategory: 'Tools',
      stage: 'production',
      launchUrls: { mainnet: 'https://main.example.org/' },
    },
  ],
};

function memoryCache(): DappCatalogCacheRepository & {
  snapshot: (networkId: string) => DappCatalogCacheSnapshot | undefined;
} {
  const records = new Map<string, DappCatalogCacheSnapshot>();
  return {
    read: networkId => records.get(networkId),
    replace: value => {
      const checked = normalizeDappCatalogCache(value, value.networkId);
      if (!checked) throw new Error('bad-cache');
      records.set(checked.networkId, checked);
    },
    snapshot: networkId => records.get(networkId),
  };
}

describe('S14 FChain public catalog', () => {
  it('uses only public HTTPS URLs from the active network; a listing never grants access', () => {
    expect(catalogEntriesFromFchain(payload, 'stellar-testnet')).toEqual([
      {
        id: 'demo',
        title: 'Demo',
        description: 'A public listing',
        category: 'Tools',
        websiteUrl: 'https://demo.example.org/app',
      },
    ]);
    expect(catalogEntriesFromFchain(payload, 'stellar-mainnet').map(e => e.id)).toEqual(['demo', 'main-only']);
    expect(
      catalogEntriesFromFchain(
        { ...payload, all: [{ ...payload.all[0], launchUrls: { testnet: 'http://localhost/' } }] },
        'stellar-testnet',
      ),
    ).toEqual([]);
  });

  it('rejects unsupported networks without fetching or reusing testnet URLs', async () => {
    const fetchImpl = jest.fn();
    const catalog = createFchainCatalog({
      cache: memoryCache(),
      networkId: 'stellar-futurenet',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await expect(catalog.load()).resolves.toEqual({ kind: 'unavailable' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('stores the network-scoped result, conditional GET, and reports stale fallback on failure', async () => {
    const cache = memoryCache();
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(payload), { status: 200, headers: { etag: '"revision"' } }))
      .mockRejectedValueOnce(new Error('offline'));
    const catalog = createFchainCatalog({
      cache,
      networkId: 'stellar-testnet',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: () => 20,
    });

    await expect(catalog.load()).resolves.toMatchObject({ kind: 'ready', entries: [{ id: 'demo' }] });
    expect(cache.snapshot('stellar-testnet')?.etag).toBe('"revision"');
    await expect(catalog.load()).resolves.toMatchObject({ kind: 'ready', stale: true, entries: [{ id: 'demo' }] });
    expect(fetchImpl.mock.calls[1][1].headers['If-None-Match']).toBe('"revision"');
    expect(cache.snapshot('stellar-mainnet')).toBeUndefined();
  });

  it('uses 304 as validated fresh cache, without stale warning', async () => {
    const cache = memoryCache();
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(payload), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 304 }));
    const catalog = createFchainCatalog({
      cache,
      networkId: 'stellar-testnet',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: () => 20,
    });
    await catalog.load();
    const result = await catalog.load();
    expect(result.kind).toBe('ready');
    expect(result).not.toHaveProperty('stale');
  });

  it('treats unexpected schema as error, not a legitimate empty catalog', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(new Response(JSON.stringify({ all: [] }), { status: 200 }));
    const cache = memoryCache();
    const catalog = createFchainCatalog({
      cache,
      networkId: 'stellar-testnet',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await expect(catalog.load()).rejects.toThrow('dapp-catalog-unavailable');
    expect(cache.snapshot('stellar-testnet')).toBeUndefined();
  });

  it('does not reuse a different network cache when the request fails', async () => {
    const cache = memoryCache();
    cache.replace({
      schemaVersion: 1,
      networkId: 'stellar-mainnet',
      savedAtUnixMs: 20,
      entries: [
        { id: 'main', title: 'Main', description: 'Main', category: 'Tools', websiteUrl: 'https://main.example.org/' },
      ],
    });
    const catalog = createFchainCatalog({
      cache,
      networkId: 'stellar-testnet',
      fetchImpl: jest.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch,
    });
    await expect(catalog.load()).rejects.toThrow('dapp-catalog-unavailable');
  });

  it('keeps a prior snapshot when a remote schema changes unexpectedly', async () => {
    const cache = memoryCache();
    cache.replace({
      schemaVersion: 1,
      networkId: 'stellar-testnet',
      savedAtUnixMs: 20,
      entries: [
        { id: 'old', title: 'Old', description: 'Old', category: 'Tools', websiteUrl: 'https://old.example.org/' },
      ],
    });
    const catalog = createFchainCatalog({
      cache,
      networkId: 'stellar-testnet',
      fetchImpl: jest
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ schemaVersion: 2, all: [] }), { status: 200 }),
        ) as unknown as typeof fetch,
    });
    await expect(catalog.load()).resolves.toMatchObject({ kind: 'ready', stale: true, entries: [{ id: 'old' }] });
    expect(cache.snapshot('stellar-testnet')?.entries[0].id).toBe('old');
  });
});
