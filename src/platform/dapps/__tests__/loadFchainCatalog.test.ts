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
  it('hydrates public cached catalog offline without fetching or leaking to another network', () => {
    const cache = memoryCache();
    cache.replace({
      schemaVersion: 1,
      networkId: 'stellar-mainnet',
      savedAtUnixMs: 20,
      entries: [
        { id: 'main', title: 'Main', description: 'Main', category: 'Tools', websiteUrl: 'https://main.example.org/' },
      ],
    });
    const fetchImpl = jest.fn();
    const mainnet = createFchainCatalog({
      cache,
      networkId: 'stellar-mainnet',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const testnet = createFchainCatalog({
      cache,
      networkId: 'stellar-testnet',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(mainnet.readCached()).toEqual({
      kind: 'ready',
      stale: true,
      entries: cache.snapshot('stellar-mainnet')?.entries,
    });
    expect(testnet.readCached()).toEqual({ kind: 'unavailable' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('retires an in-flight catalog fetch before it can write to Realm or update the new session', async () => {
    const cache = memoryCache();
    let complete!: (response: Response) => void;
    const fetchImpl = jest.fn(
      (_url: string, _options: RequestInit) =>
        new Promise<Response>(resolve => {
          complete = resolve;
        }),
    );
    const oldSession = createFchainCatalog({
      cache,
      networkId: 'stellar-testnet',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const pending = oldSession.load();
    const signal = fetchImpl.mock.calls[0][1].signal as AbortSignal;
    oldSession.close();
    expect(signal.aborted).toBe(true);
    complete(new Response(JSON.stringify(payload), { status: 200 }));
    await expect(pending).rejects.toThrow('network-session-retired');
    expect(cache.snapshot('stellar-testnet')).toBeUndefined();
    expect(oldSession.readCached()).toEqual({ kind: 'unavailable' });
    await expect(oldSession.load()).rejects.toThrow('network-session-retired');
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const newSession = createFchainCatalog({
      cache,
      networkId: 'stellar-mainnet',
      fetchImpl: jest.fn(async () => new Response(JSON.stringify(payload), { status: 200 })) as unknown as typeof fetch,
      now: () => 30,
    });
    await expect(newSession.load()).resolves.toMatchObject({
      kind: 'ready',
      entries: [{ id: 'demo' }, { id: 'main-only' }],
    });
    expect(cache.snapshot('stellar-testnet')).toBeUndefined();
    expect(cache.snapshot('stellar-mainnet')?.entries).toHaveLength(2);
  });

  it('keeps public cache across same-network node renewal without returning a retired fallback', async () => {
    const cache = memoryCache();
    cache.replace({
      schemaVersion: 1,
      networkId: 'stellar-testnet',
      savedAtUnixMs: 20,
      entries: [
        {
          id: 'saved',
          title: 'Saved',
          description: 'Cached',
          category: 'Tools',
          websiteUrl: 'https://saved.example.org/',
        },
      ],
    });
    let failFetch!: (error: Error) => void;
    const oldSession = createFchainCatalog({
      cache,
      networkId: 'stellar-testnet',
      fetchImpl: jest.fn(
        () =>
          new Promise<Response>((_resolve, reject) => {
            failFetch = reject;
          }),
      ) as unknown as typeof fetch,
    });
    const pending = oldSession.load();
    oldSession.close();
    failFetch(new Error('offline'));
    await expect(pending).rejects.toThrow('network-session-retired');
    expect(cache.snapshot('stellar-testnet')?.entries[0].id).toBe('saved');

    // A verified endpoint change reuses the network partition but not the old catalog session.
    const renewed = createFchainCatalog({
      cache,
      networkId: 'stellar-testnet',
      fetchImpl: jest.fn() as unknown as typeof fetch,
    });
    expect(renewed.readCached()).toMatchObject({ kind: 'ready', stale: true, entries: [{ id: 'saved' }] });
  });

  it('blocks a late response body after session retirement even if abort is ignored', async () => {
    const cache = memoryCache();
    let completeBody!: (value: string) => void;
    const text = jest.fn(
      () =>
        new Promise<string>(resolve => {
          completeBody = resolve;
        }),
    );
    const response = {
      status: 200,
      url: 'https://dapp.fchain.io/v1',
      headers: new Headers(),
      text,
    } as unknown as Response;
    const catalog = createFchainCatalog({
      cache,
      networkId: 'stellar-testnet',
      fetchImpl: jest.fn(async () => response) as unknown as typeof fetch,
    });
    const pending = catalog.load();
    for (let i = 0; i < 10 && text.mock.calls.length === 0; i += 1) await Promise.resolve();
    expect(text).toHaveBeenCalledTimes(1);
    catalog.close();
    completeBody(JSON.stringify(payload));
    await expect(pending).rejects.toThrow('network-session-retired');
    expect(cache.snapshot('stellar-testnet')).toBeUndefined();
  });
});
