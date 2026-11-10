import { createTokenIconPort } from '../TokenIconPort';
import { createCachedAssetCatalog } from '../CachedAssetCatalog';
import {
  CURATED_CACHE_FAILURE_COOLDOWN_MS,
  type CuratedSourceCacheRepository,
  type CuratedSourceSnapshot,
} from '../../../capabilities/trustline/curatedSourceCache';
import type { TokenMetadataPort } from '../TokenMetadataResolver';
import type { SafePublicTransport } from '../NativeSafePublicTransport';

const issuer = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';
const asset = { kind: 'credit' as const, code: 'Usd', issuer };
const first = 'https://cdn.example.org/one.png';
const second = 'https://cdn.example.org/two.png';
const dataUri = 'data:image/png;base64,iVBORw0KGgo=';

function setup(networkId = 'stellar-mainnet', isNativeAvailable = true) {
  let now = 1000;
  const readIcon = jest.fn(async (url: string) => {
    if (url === first) throw new Error('bad-image');
    return { mimeType: 'image/png' as const, dataUri };
  });
  const metadata: TokenMetadataPort = {
    peek: jest.fn(() => ({ source: 'curated', icons: [first, second] })),
    resolve: jest.fn(async () => ({
      metadata: { source: 'curated' as const, icons: [first, second] },
      fromCache: false,
      stale: false,
      refreshFailed: false,
    })),
    close: jest.fn(),
  };
  const transport: SafePublicTransport = {
    available: isNativeAvailable,
    readIcon,
    readText: jest.fn(),
    close: jest.fn(),
  };
  const icons = createTokenIconPort({ networkId, metadata, transport, now: () => now });
  return {
    icons,
    readIcon,
    metadata,
    transport,
    advance: (milliseconds: number) => {
      now += milliseconds;
    },
  };
}

describe('S06 token icon opt-in, fallback and lifecycle', () => {
  it('starts enabled for automatic logos when configured and does no background image fetch without an asset consumer', async () => {
    const baseline = setup();
    baseline.icons.close();
    const readIcon = jest.fn(async () => ({ mimeType: 'image/png' as const, dataUri }));
    const metadata: TokenMetadataPort = {
      peek: () => ({ source: 'curated', icons: [second] }),
      resolve: async () => ({
        metadata: { source: 'curated', icons: [second] },
        fromCache: false,
        stale: false,
        refreshFailed: false,
      }),
      close: jest.fn(),
    };
    const transport: SafePublicTransport = {
      available: true,
      readIcon,
      readText: jest.fn(),
      close: jest.fn(),
    };
    const icons = createTokenIconPort({
      networkId: 'stellar-mainnet',
      metadata,
      transport,
      initialEnabled: true,
    });
    expect(icons.getSnapshot().enabled).toBe(true);
    expect(readIcon).not.toHaveBeenCalled();
    expect(await icons.loadIcon(asset, new AbortController().signal)).toBe(dataUri);
    expect(readIcon).toHaveBeenCalledTimes(1);
    icons.setEnabled(false);
    expect(icons.getSnapshot().enabled).toBe(false);
    expect(icons.readIcon(asset)).toBeUndefined();
    expect(await icons.loadIcon(asset, new AbortController().signal)).toBeUndefined();
    expect(readIcon).toHaveBeenCalledTimes(1);
    icons.setEnabled(true);
    expect(await icons.loadIcon(asset, new AbortController().signal)).toBe(dataUri);
    expect(readIcon).toHaveBeenCalledTimes(2);
    icons.close();
  });

  it('does not request any remote image before explicit Mainnet consent', async () => {
    const { icons, readIcon } = setup();
    expect(icons.getSnapshot().enabled).toBe(false);
    expect(await icons.loadIcon(asset, new AbortController().signal)).toBeUndefined();
    expect(readIcon).not.toHaveBeenCalled();
    expect(icons.readIcon(asset)).toBeUndefined();
    icons.close();
  });

  it('supports Testnet and fails closed when native transport or a supported network is absent', async () => {
    for (const { network, native } of [
      { network: 'unsupported-network', native: true },
      { network: 'stellar-mainnet', native: false },
      { network: 'stellar-testnet', native: false },
    ]) {
      const { icons, readIcon } = setup(network, native);
      expect(icons.available).toBe(false);
      icons.setEnabled(true);
      expect(icons.getSnapshot().enabled).toBe(false);
      await icons.loadIcon(asset, new AbortController().signal);
      expect(readIcon).not.toHaveBeenCalled();
      icons.close();
    }
  });

  it('loads issuer icons on Testnet only after consent and keeps network-scoped identity', async () => {
    const { icons, readIcon, metadata } = setup('stellar-testnet');
    expect(icons.available).toBe(true);
    expect(await icons.loadIcon(asset, new AbortController().signal)).toBeUndefined();
    icons.setEnabled(true);
    expect(await icons.loadIcon(asset, new AbortController().signal)).toBe(dataUri);
    expect(readIcon).toHaveBeenCalledTimes(2);
    expect(metadata.resolve).toHaveBeenCalledTimes(1);
    icons.close();
  });

  it('loads Mainnet public sources once per opt-in even for concurrent assets', async () => {
    const { icons: unused } = setup();
    unused.close();
    const sourceLoads: string[] = [];
    const catalog = {
      read: jest.fn(),
      loadSource: jest.fn(async (_network: string, sourceId: string) => {
        sourceLoads.push(sourceId);
        return { assets: [], fromCache: false, stale: false, refreshFailed: false };
      }),
    };
    const metadata: TokenMetadataPort = {
      peek: jest.fn(() => ({ source: 'curated' as const, icons: [second] })),
      resolve: jest.fn(async () => ({
        metadata: { source: 'curated' as const, icons: [second] },
        fromCache: true,
        stale: false,
        refreshFailed: false,
      })),
      close: jest.fn(),
    };
    const transport: SafePublicTransport = {
      available: true,
      readIcon: jest.fn(async () => ({ mimeType: 'image/png' as const, dataUri })),
      readText: jest.fn(),
      close: jest.fn(),
    };
    const icons = createTokenIconPort({ networkId: 'stellar-mainnet', metadata, catalog, transport });
    expect(catalog.loadSource).not.toHaveBeenCalled();
    icons.setEnabled(true);
    await Promise.all([
      icons.loadIcon(asset, new AbortController().signal),
      icons.loadIcon({ ...asset, code: 'EUR' }, new AbortController().signal),
    ]);
    expect(sourceLoads).toEqual(['lobstr', 'soroswap', 'stellarexpert']);
    expect(metadata.resolve).toHaveBeenCalledTimes(2);
    icons.close();
  });

  it('recovers curated-only logos after offline bootstrap and source cooldown in one enabled session', async () => {
    let now = 10_000;
    let online = false;
    const stored = new Map<string, CuratedSourceSnapshot>();
    const cache: CuratedSourceCacheRepository = {
      read: (_networkId, sourceId) => stored.get(sourceId),
      replace: snapshot => {
        stored.set(snapshot.sourceId, snapshot);
      },
    };
    const read = jest.fn(async () => {
      if (!online) throw new Error('offline');
      return JSON.stringify({ assets: [{ code: asset.code, issuer: asset.issuer, icon: second }] });
    });
    const catalog = createCachedAssetCatalog({
      networkId: 'stellar-mainnet',
      cache,
      http: { read },
      now: () => now,
    });
    const curatedMetadata = (identity: typeof asset) => {
      const row = catalog
        .readCachedSource('stellar-mainnet', 'lobstr')
        ?.assets.find(item => item.code === identity.code && item.issuer === identity.issuer);
      return row?.icon ? { source: 'curated' as const, icons: [row.icon] } : undefined;
    };
    const metadata: TokenMetadataPort = {
      peek: curatedMetadata,
      resolve: jest.fn(async identity => ({
        metadata: curatedMetadata(identity),
        fromCache: false,
        stale: true,
        refreshFailed: true,
      })),
      close: jest.fn(),
    };
    const readIcon = jest.fn(async () => ({ mimeType: 'image/png' as const, dataUri }));
    const transport: SafePublicTransport = {
      available: true,
      readIcon,
      readText: jest.fn(),
      close: jest.fn(),
    };
    const icons = createTokenIconPort({
      networkId: 'stellar-mainnet',
      catalog,
      metadata,
      transport,
      initialEnabled: true,
      now: () => now,
    });

    // The first mounted consumer has no cached directory or issuer TOML.
    expect(await icons.loadIcon(asset, new AbortController().signal)).toBeUndefined();
    expect(read).toHaveBeenCalledTimes(3);
    expect(readIcon).not.toHaveBeenCalled();

    // Another mount during the 30-second failure cooldown cannot hammer a
    // disconnected provider. Catalog retry policy stays in CachedAssetCatalog.
    expect(await icons.loadIcon(asset, new AbortController().signal)).toBeUndefined();
    expect(read).toHaveBeenCalledTimes(3);

    // The network comes back in the same AppServices session. The following
    // mounted consumer must re-enter loadSource and obtain its new logo.
    online = true;
    now += CURATED_CACHE_FAILURE_COOLDOWN_MS + 1;
    expect(await icons.loadIcon(asset, new AbortController().signal)).toBe(dataUri);
    expect(read).toHaveBeenCalledTimes(6);
    expect(readIcon).toHaveBeenCalledWith(second, expect.any(AbortSignal));
    expect(icons.readIcon(asset)).toBe(dataUri);

    // Fresh 12-hour catalog snapshots prevent redundant network calls even
    // though subsequent consumers may request a catalog refresh.
    expect(await icons.loadIcon({ ...asset, code: 'EUR' }, new AbortController().signal)).toBeUndefined();
    expect(read).toHaveBeenCalledTimes(6);
    icons.close();
    catalog.close();
  });

  it('retries a second candidate after the decoded image fails in React Native', async () => {
    const { icons, readIcon } = setup();
    icons.setEnabled(true);
    expect(await icons.loadIcon(asset, new AbortController().signal)).toBe(dataUri);
    icons.rejectIcon(asset, dataUri);
    expect(icons.readIcon(asset)).toBeUndefined();
    expect(await icons.loadIcon(asset, new AbortController().signal)).toBeUndefined();
    // The URL that produced the rejected URI joins failed-candidate cooldown.
    expect(readIcon).toHaveBeenCalledTimes(2);
    icons.close();
  });

  it('tries the next curated candidate and caches only local data URIs for ten minutes', async () => {
    const { icons, readIcon, metadata, advance } = setup();
    const callback = jest.fn();
    const unsubscribe = icons.subscribe(callback);
    icons.setEnabled(true);
    expect(icons.getSnapshot().enabled).toBe(true);
    expect(await icons.loadIcon(asset, new AbortController().signal)).toBe(dataUri);
    expect(readIcon).toHaveBeenCalledTimes(2);
    expect(metadata.resolve).toHaveBeenCalledTimes(1);
    expect(icons.readIcon(asset)).toBe(dataUri);
    expect(await icons.loadIcon(asset, new AbortController().signal)).toBe(dataUri);
    expect(readIcon).toHaveBeenCalledTimes(2);
    advance(10 * 60 * 1000);
    expect(icons.readIcon(asset)).toBeUndefined();
    expect(await icons.loadIcon(asset, new AbortController().signal)).toBe(dataUri);
    // The first candidate is in the 60-minute failure cooldown.
    expect(readIcon).toHaveBeenCalledTimes(3);
    expect(callback).toHaveBeenCalled();
    unsubscribe();
    icons.close();
  });

  it('does not allow exact-code/issuer cache collisions or retain images after opt-out', async () => {
    const { icons, readIcon } = setup();
    icons.setEnabled(true);
    await icons.loadIcon(asset, new AbortController().signal);
    expect(icons.readIcon({ ...asset, code: 'USD' })).toBeUndefined();
    expect(icons.readIcon({ ...asset, issuer: 'GA'.padEnd(56, 'A') })).toBeUndefined();
    icons.setEnabled(false);
    expect(icons.readIcon(asset)).toBeUndefined();
    await icons.loadIcon(asset, new AbortController().signal);
    expect(readIcon).toHaveBeenCalledTimes(2);
    icons.close();
  });

  it('cancels pending icon loads on opt-out and service close', async () => {
    let resolve!: (value: { mimeType: 'image/png'; dataUri: string }) => void;
    const readIcon = jest.fn(() => new Promise<{ mimeType: 'image/png'; dataUri: string }>(done => (resolve = done)));
    const metadata: TokenMetadataPort = {
      peek: () => ({ source: 'curated', icons: [second] }),
      resolve: jest.fn(async () => ({
        metadata: { source: 'curated' as const, icons: [second] },
        fromCache: true,
        stale: false,
        refreshFailed: false,
      })),
      close: jest.fn(),
    };
    const transport: SafePublicTransport = {
      available: true,
      readIcon,
      readText: jest.fn(),
      close: jest.fn(),
    };
    const icons = createTokenIconPort({ networkId: 'stellar-mainnet', metadata, transport });
    icons.setEnabled(true);
    const pending = icons.loadIcon(asset, new AbortController().signal);
    await new Promise<void>(resolveNext => setImmediate(resolveNext));
    expect(readIcon).toHaveBeenCalledTimes(1);
    icons.setEnabled(false);
    resolve({ mimeType: 'image/png', dataUri });
    expect(await pending).toBeUndefined();
    expect(icons.readIcon(asset)).toBeUndefined();
    icons.close();
    expect(transport.close).toHaveBeenCalledTimes(1);
    expect(metadata.close).toHaveBeenCalledTimes(1);
  });
});
