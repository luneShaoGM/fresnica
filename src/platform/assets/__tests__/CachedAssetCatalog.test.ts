import { CURATED_ASSET_SOURCES } from '../../../capabilities/trustline/curatedAssetCatalog';
import {
  CURATED_CACHE_FAILURE_COOLDOWN_MS,
  CURATED_CACHE_TTL_MS,
  type CuratedSourceCacheRepository,
  type CuratedSourceSnapshot,
} from '../../../capabilities/trustline/curatedSourceCache';
import { createCachedAssetCatalog } from '../CachedAssetCatalog';

const issuer = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';
const original = { code: 'Usd', issuer };
const payload = JSON.stringify({ assets: [original] });

function memoryCache() {
  const items = new Map<string, CuratedSourceSnapshot>();
  const key = (networkId: string, sourceId: string) => JSON.stringify([networkId, sourceId]);
  const cache: CuratedSourceCacheRepository = {
    read: (networkId, sourceId) => items.get(key(networkId, sourceId)),
    replace: jest.fn(snapshot => items.set(key(snapshot.networkId, snapshot.sourceId), snapshot)),
  };
  return { cache, items };
}

describe('S06 cached public asset catalog', () => {
  it('fetches only the approved Mainnet source and reuses its 12-hour snapshot without I/O', async () => {
    let now = 5_000;
    const store = memoryCache();
    const read = jest.fn(async () => payload);
    const catalog = createCachedAssetCatalog({
      networkId: 'stellar-mainnet',
      cache: store.cache,
      http: { read },
      now: () => now,
    });
    const signal = new AbortController().signal;
    expect(await catalog.loadSource('stellar-mainnet', 'lobstr', signal)).toEqual({
      assets: [original],
      fromCache: false,
      stale: false,
      refreshFailed: false,
    });
    expect(read).toHaveBeenCalledWith(CURATED_ASSET_SOURCES[0].url, expect.any(AbortSignal));
    expect(store.cache.replace).toHaveBeenCalledTimes(1);
    expect(catalog.readCachedSource('stellar-mainnet', 'lobstr')?.assets).toEqual([original]);
    now += CURATED_CACHE_TTL_MS - 1;
    expect(await catalog.loadSource('stellar-mainnet', 'lobstr', signal)).toMatchObject({
      fromCache: true,
      stale: false,
    });
    expect(read).toHaveBeenCalledTimes(1);
    now += 1;
    expect(catalog.readCachedSource('stellar-mainnet', 'lobstr')?.stale).toBe(true);
    expect(await catalog.loadSource('stellar-mainnet', 'lobstr', signal)).toMatchObject({ fromCache: false });
    expect(read).toHaveBeenCalledTimes(2);
    catalog.close();
  });

  it('caches all issued Soroswap icon rows beside unsupported contract-only rows, but rejects actual corruption', async () => {
    let now = 15_000;
    const store = memoryCache();
    const issued = { ...original, icon: 'https://cdn.example.org/usd.png' };
    const contractOnly = {
      code: 'JQQQ',
      contract: 'CAQYPRTX2E6H6BM57QRBYZWP667FPDYDUHMOQXGXM2HA64KO6AISRFEK',
      icon: 'https://cdn.example.org/contract.png',
      decimals: 18,
    };
    const read = jest.fn(async () => JSON.stringify({ assets: [issued, contractOnly] }));
    const catalog = createCachedAssetCatalog({
      networkId: 'stellar-mainnet',
      cache: store.cache,
      http: { read },
      now: () => now,
    });
    const signal = new AbortController().signal;
    expect(await catalog.loadSource('stellar-mainnet', 'soroswap', signal)).toMatchObject({
      assets: [issued],
      fromCache: false,
      refreshFailed: false,
    });
    expect(catalog.readCachedSource('stellar-mainnet', 'soroswap')?.assets).toEqual([issued]);
    expect(store.cache.replace).toHaveBeenCalledTimes(1);

    // An issuer-bearing row that is actually malformed still fails the
    // complete source and must not replace last-good published imagery.
    now += CURATED_CACHE_TTL_MS;
    read.mockResolvedValue(
      JSON.stringify({
        assets: [issued, { ...contractOnly, issuer: 'bad-issuer' }],
      }),
    );
    expect(await catalog.loadSource('stellar-mainnet', 'soroswap', signal)).toMatchObject({
      assets: [issued],
      fromCache: true,
      stale: true,
      refreshFailed: true,
    });
    expect(catalog.readCachedSource('stellar-mainnet', 'soroswap')?.assets).toEqual([issued]);
    expect(store.cache.replace).toHaveBeenCalledTimes(1);
    catalog.close();
  });

  it('retains stale last-good data on malformed JSON, never overwriting it with an empty-looking error', async () => {
    let now = 10_000;
    const store = memoryCache();
    const read = jest.fn(async () => payload);
    const catalog = createCachedAssetCatalog({
      networkId: 'stellar-mainnet',
      cache: store.cache,
      http: { read },
      now: () => now,
    });
    const signal = new AbortController().signal;
    await catalog.loadSource('stellar-mainnet', 'lobstr', signal);
    const before = store.cache.read('stellar-mainnet', 'lobstr');
    now += CURATED_CACHE_TTL_MS;
    read.mockResolvedValue('{"error":"upstream unavailable"}');
    expect(await catalog.loadSource('stellar-mainnet', 'lobstr', signal)).toMatchObject({
      assets: [original],
      fromCache: true,
      stale: true,
      refreshFailed: true,
    });
    expect(store.cache.read('stellar-mainnet', 'lobstr')).toEqual(before);
    expect(store.cache.replace).toHaveBeenCalledTimes(1);
    // Failure cooling prevents a page reopen from hammering an unhealthy source.
    await catalog.loadSource('stellar-mainnet', 'lobstr', signal);
    expect(read).toHaveBeenCalledTimes(2);
    now += CURATED_CACHE_FAILURE_COOLDOWN_MS;
    await catalog.loadSource('stellar-mainnet', 'lobstr', signal);
    expect(read).toHaveBeenCalledTimes(3);
  });

  it('retains all last-good assets when a refresh mixes valid and invalid rows', async () => {
    let now = 12_000;
    const store = memoryCache();
    const second = { code: 'BTC', issuer };
    const read = jest.fn(async () => JSON.stringify({ assets: [original, second] }));
    const catalog = createCachedAssetCatalog({
      networkId: 'stellar-mainnet',
      cache: store.cache,
      http: { read },
      now: () => now,
    });
    const signal = new AbortController().signal;
    await catalog.loadSource('stellar-mainnet', 'lobstr', signal);
    const before = store.cache.read('stellar-mainnet', 'lobstr');
    expect(before?.assets).toEqual([original, second]);
    now += CURATED_CACHE_TTL_MS;
    read.mockResolvedValue(JSON.stringify({ assets: [original, { code: 'broken!', issuer }] }));
    expect(await catalog.loadSource('stellar-mainnet', 'lobstr', signal)).toEqual({
      assets: [original, second],
      fromCache: true,
      stale: true,
      refreshFailed: true,
    });
    expect(store.cache.read('stellar-mainnet', 'lobstr')).toEqual(before);
    expect(store.cache.replace).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenCalledTimes(2);
    expect(await catalog.loadSource('stellar-mainnet', 'lobstr', signal)).toMatchObject({
      assets: [original, second],
      fromCache: true,
      stale: true,
      refreshFailed: true,
    });
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('allows explicit retry to bypass cooldown, preserving last-good on fetch rejection', async () => {
    let now = 7_000;
    const store = memoryCache();
    const read = jest.fn(async () => payload);
    const catalog = createCachedAssetCatalog({
      networkId: 'stellar-mainnet',
      cache: store.cache,
      http: { read },
      now: () => now,
    });
    const signal = new AbortController().signal;
    await catalog.loadSource('stellar-mainnet', 'soroswap', signal);
    now += CURATED_CACHE_TTL_MS;
    read.mockRejectedValue(new Error('offline'));
    await catalog.loadSource('stellar-mainnet', 'soroswap', signal);
    expect(await catalog.loadSource('stellar-mainnet', 'soroswap', signal)).toMatchObject({
      refreshFailed: true,
    });
    expect(read).toHaveBeenCalledTimes(2);
    await catalog.loadSource('stellar-mainnet', 'soroswap', signal, true);
    expect(read).toHaveBeenCalledTimes(3);
    expect(store.cache.read('stellar-mainnet', 'soroswap')?.assets).toEqual([original]);
  });

  it('never reads or persists a Mainnet source on Testnet or another configured network', async () => {
    const store = memoryCache();
    const read = jest.fn(async () => payload);
    const catalog = createCachedAssetCatalog({
      networkId: 'stellar-testnet',
      cache: store.cache,
      http: { read },
    });
    expect(catalog.readCachedSource('stellar-testnet', 'lobstr')).toBeUndefined();
    await expect(catalog.loadSource('stellar-testnet', 'lobstr', new AbortController().signal)).rejects.toThrow(
      'asset-catalog-source-unavailable',
    );
    await expect(catalog.loadSource('stellar-mainnet', 'lobstr', new AbortController().signal)).rejects.toThrow(
      'asset-catalog-network-mismatch',
    );
    expect(read).not.toHaveBeenCalled();
    expect(store.cache.replace).not.toHaveBeenCalled();
  });

  it('does not cache arbitrary manually supplied URLs', async () => {
    const store = memoryCache();
    const read = jest.fn(async () => '[[CURRENCIES]]');
    const catalog = createCachedAssetCatalog({
      networkId: 'stellar-mainnet',
      cache: store.cache,
      http: { read },
    });
    expect(await catalog.read('https://example.org/.well-known/stellar.toml', new AbortController().signal)).toBe(
      '[[CURRENCIES]]',
    );
    expect(store.cache.replace).not.toHaveBeenCalled();
    expect(read).toHaveBeenCalledWith('https://example.org/.well-known/stellar.toml', expect.any(AbortSignal));
  });

  it('rejects obsolete late responses after dismissal and service retirement without cache writes', async () => {
    const store = memoryCache();
    let resolve!: (value: string) => void;
    const read = jest.fn(() => new Promise<string>(done => (resolve = done)));
    const catalog = createCachedAssetCatalog({
      networkId: 'stellar-mainnet',
      cache: store.cache,
      http: { read },
    });
    const controller = new AbortController();
    const request = catalog.loadSource('stellar-mainnet', 'lobstr', controller.signal);
    controller.abort();
    resolve(payload);
    await expect(request).rejects.toThrow('asset-catalog-cancelled');
    expect(store.cache.replace).not.toHaveBeenCalled();
    const second = catalog.loadSource('stellar-mainnet', 'lobstr', new AbortController().signal);
    catalog.close();
    resolve(payload);
    await expect(second).rejects.toThrow('asset-catalog-cancelled');
    expect(store.cache.replace).not.toHaveBeenCalled();
    expect(catalog.readCachedSource('stellar-mainnet', 'lobstr')).toBeUndefined();
  });

  it('never lets an older same-source response overwrite a newer successful refresh', async () => {
    const store = memoryCache();
    const requests: Array<(value: string) => void> = [];
    const read = jest.fn(
      () =>
        new Promise<string>(resolve => {
          requests.push(resolve);
        }),
    );
    const catalog = createCachedAssetCatalog({
      networkId: 'stellar-mainnet',
      cache: store.cache,
      http: { read },
    });
    const signal = new AbortController().signal;
    const oldRequest = catalog.loadSource('stellar-mainnet', 'lobstr', signal);
    const oldResult = oldRequest.catch((error: unknown) => error);
    const recent = catalog.loadSource('stellar-mainnet', 'lobstr', signal, true);
    expect(requests).toHaveLength(2);
    requests[1](JSON.stringify([{ code: 'EUR', issuer }]));
    expect((await recent).assets).toEqual([{ code: 'EUR', issuer }]);
    requests[0](payload);
    expect(await oldResult).toEqual(new Error('asset-catalog-superseded'));
    expect(store.cache.read('stellar-mainnet', 'lobstr')?.assets).toEqual([{ code: 'EUR', issuer }]);
    expect(store.cache.replace).toHaveBeenCalledTimes(1);
  });

  it('never interprets an invalid success payload as an authoritative empty catalog', async () => {
    const store = memoryCache();
    const read = jest.fn(async () => '{"assets":[{"error":"broken"}]}');
    const catalog = createCachedAssetCatalog({
      networkId: 'stellar-mainnet',
      cache: store.cache,
      http: { read },
    });
    await expect(catalog.loadSource('stellar-mainnet', 'lobstr', new AbortController().signal)).rejects.toThrow(
      'curated-source-invalid',
    );
    expect(store.cache.replace).not.toHaveBeenCalled();
  });
});
