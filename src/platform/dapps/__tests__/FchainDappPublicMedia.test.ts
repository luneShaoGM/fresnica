import {
  DAPP_DETAIL_RETRY_MS,
  DAPP_DETAIL_TTL_MS,
  DAPP_ICON_FAILURE_TTL_MS,
  type DappDetailCacheRepository,
  type DappDetailSnapshot,
} from '../../../capabilities/dapp-catalog/dappDetails';
import type { DappCatalogEntry } from '../../../capabilities/dapp-catalog/catalog';
import type { SafePublicTransport } from '../../assets/NativeSafePublicTransport';
import { createFchainDappPublicMedia } from '../FchainDappPublicMedia';

const icon = 'https://cdn.example.org/demo.png';
const alternate = 'https://cdn.example.org/demo2.png';
const sample: DappCatalogEntry = {
  id: 'demo.app',
  title: 'Demo',
  description: 'Brief',
  category: 'Tools',
  websiteUrl: 'https://demo.example.org/app',
  iconUrl: icon,
};
const remote = {
  stage: 'production',
  identifier: 'demo.app',
  name: 'Demo',
  shortDescription: 'Brief',
  description: 'The detailed directory description',
  developer: { name: 'Developer' },
  primaryCategory: 'Tools',
  iconUrl: alternate,
  launchUrls: { mainnet: 'https://demo.example.org/app', testnet: 'https://demo.example.org/test' },
};

function memoryCache() {
  const values = new Map<string, DappDetailSnapshot>();
  const cache: DappDetailCacheRepository = {
    read: (network, appId) => values.get(JSON.stringify([network, appId])),
    replace: jest.fn(snapshot => values.set(JSON.stringify([snapshot.networkId, snapshot.appId]), snapshot)),
  };
  return { cache, values };
}

describe('LC5 S14 dApp detail and icon candidate consumer', () => {
  it('holds 24-hour detail without network work and supports per-network exact identity', async () => {
    let now = 1000;
    const { cache } = memoryCache();
    const transport: SafePublicTransport = {
      available: true,
      readText: jest.fn(async () => JSON.stringify(remote)),
      readIcon: jest.fn(),
      close: jest.fn(),
    };
    const service = createFchainDappPublicMedia({ networkId: 'stellar-mainnet', cache, transport, now: () => now });
    const first = await service.loadDetail('demo.app', new AbortController().signal);
    expect(first).toMatchObject({
      detail: { id: 'demo.app', developerName: 'Developer', iconUrl: alternate },
      fromCache: false,
      stale: false,
    });
    expect(transport.readText).toHaveBeenCalledWith(
      'https://dapp.fchain.io/v1/dapps/demo.app',
      expect.any(AbortSignal),
    );
    expect(service.readCachedDetail('demo.app')?.detail.longDescription).toBe(remote.description);
    now += DAPP_DETAIL_TTL_MS - 1;
    expect(await service.loadDetail('demo.app', new AbortController().signal)).toMatchObject({
      fromCache: true,
      stale: false,
    });
    expect(transport.readText).toHaveBeenCalledTimes(1);
    const testnet = createFchainDappPublicMedia({
      networkId: 'stellar-testnet',
      cache,
      transport: { ...transport, close: jest.fn() },
      now: () => now,
    });
    expect(testnet.readCachedDetail('demo.app')).toBeUndefined();
    service.close();
    testnet.close();
  });

  it('retains the previous detail across offline failure and retries after 30-second cooldown', async () => {
    let now = 1000;
    const { cache } = memoryCache();
    let offline = false;
    const readText = jest.fn(async () => {
      if (offline) throw new Error('offline');
      return JSON.stringify(remote);
    });
    const service = createFchainDappPublicMedia({
      networkId: 'stellar-mainnet',
      cache,
      now: () => now,
      transport: { available: true, readText, readIcon: jest.fn(), close: jest.fn() },
    });
    await service.loadDetail('demo.app', new AbortController().signal);
    now += DAPP_DETAIL_TTL_MS;
    offline = true;
    const failed = await service.loadDetail('demo.app', new AbortController().signal);
    expect(failed).toMatchObject({ fromCache: true, stale: true, refreshFailed: true });
    now += DAPP_DETAIL_RETRY_MS - 1;
    await service.loadDetail('demo.app', new AbortController().signal);
    expect(readText).toHaveBeenCalledTimes(2);
    now += 1;
    offline = false;
    await expect(service.loadDetail('demo.app', new AbortController().signal)).resolves.toMatchObject({
      fromCache: false,
      stale: false,
      refreshFailed: false,
    });
    expect(readText).toHaveBeenCalledTimes(3);
    service.close();
  });

  it('rejects invalid and outdated detail responses rather than poisoning the last-good cache', async () => {
    const { cache } = memoryCache();
    let nextResponse!: (value: string) => void;
    const readText = jest.fn(
      () =>
        new Promise<string>(resolve => {
          nextResponse = resolve;
        }),
    );
    const service = createFchainDappPublicMedia({
      networkId: 'stellar-mainnet',
      cache,
      transport: { available: true, readText, readIcon: jest.fn(), close: jest.fn() },
    });
    const abort = new AbortController();
    const pending = service.loadDetail('demo.app', abort.signal);
    abort.abort();
    nextResponse(JSON.stringify(remote));
    await expect(pending).rejects.toThrow();
    expect(service.readCachedDetail('demo.app')).toBeUndefined();
    await expect(service.loadDetail('../secret', new AbortController().signal)).rejects.toThrow();
    expect(readText).toHaveBeenCalledTimes(1);
    service.close();
  });

  it('disables icon requests until explicit consent, caches only local data and records winner/failure evidence', async () => {
    let now = 10_000;
    const { cache } = memoryCache();
    const readIcon = jest.fn(async (url: string) => {
      if (url === icon) throw new Error('broken icon');
      return { mimeType: 'image/png' as const, dataUri: 'data:image/png;base64,iVBORw0KGgo=' };
    });
    const service = createFchainDappPublicMedia({
      networkId: 'stellar-mainnet',
      cache,
      now: () => now,
      transport: { available: true, readText: jest.fn(async () => JSON.stringify(remote)), readIcon, close: jest.fn() },
    });
    expect(service.getIconState().enabled).toBe(false);
    expect(await service.loadIcon(sample, new AbortController().signal)).toBeUndefined();
    expect(readIcon).not.toHaveBeenCalled();

    // The detail provides the secondary icon candidate. No details fetched
    // automatically by loading list icons.
    await service.loadDetail('demo.app', new AbortController().signal);
    service.setIconsEnabled(true);
    expect(await service.loadIcon(sample, new AbortController().signal)).toBe('data:image/png;base64,iVBORw0KGgo=');
    expect(readIcon).toHaveBeenCalledTimes(2);
    expect(service.readIcon(sample)).toBe('data:image/png;base64,iVBORw0KGgo=');
    expect(cache.read('stellar-mainnet', 'demo.app')?.iconPreference).toMatchObject({
      winner: alternate,
      failures: { [icon]: now + DAPP_ICON_FAILURE_TTL_MS },
    });

    now += 10 * 60 * 1000;
    expect(service.readIcon(sample)).toBeUndefined();
    expect(await service.loadIcon(sample, new AbortController().signal)).toBe('data:image/png;base64,iVBORw0KGgo=');
    expect(readIcon).toHaveBeenCalledTimes(3); // 7-day winner checked first
    service.setIconsEnabled(false);
    expect(service.readIcon(sample)).toBeUndefined();
    await service.loadIcon(sample, new AbortController().signal);
    expect(readIcon).toHaveBeenCalledTimes(3);
    service.close();
  });

  it('uses only a validated detail icon when the list has no icon and never discovers a favicon automatically', async () => {
    const { cache } = memoryCache();
    const readIcon = jest.fn(async () => ({
      mimeType: 'image/png' as const,
      dataUri: 'data:image/png;base64,iVBORw0KGgo=',
    }));
    const service = createFchainDappPublicMedia({
      networkId: 'stellar-mainnet',
      cache,
      transport: { available: true, readText: jest.fn(async () => JSON.stringify(remote)), readIcon, close: jest.fn() },
    });
    const listEntry = { ...sample, iconUrl: undefined };
    expect(await service.loadIcon(listEntry, new AbortController().signal)).toBeUndefined();
    await service.loadDetail('demo.app', new AbortController().signal);
    service.setIconsEnabled(true);
    expect(await service.loadIcon(listEntry, new AbortController().signal)).toBe('data:image/png;base64,iVBORw0KGgo=');
    expect(readIcon).toHaveBeenCalledWith(alternate, expect.any(AbortSignal));
    expect(service.readIcon(listEntry)).toBe('data:image/png;base64,iVBORw0KGgo=');
    service.close();
  });

  it('keeps the complete old detail when a new response has a wrong identity or dangerous link', async () => {
    let response: Record<string, unknown> = remote;
    const { cache } = memoryCache();
    let now = 500;
    const readText = jest.fn(async () => JSON.stringify(response));
    const service = createFchainDappPublicMedia({
      networkId: 'stellar-mainnet',
      cache,
      now: () => now,
      transport: { available: true, readText, readIcon: jest.fn(), close: jest.fn() },
    });
    const previous = await service.loadDetail('demo.app', new AbortController().signal);
    now += DAPP_DETAIL_TTL_MS;
    response = { ...remote, identifier: 'another.app' };
    expect(await service.loadDetail('demo.app', new AbortController().signal)).toMatchObject({
      detail: previous.detail,
      fromCache: true,
      stale: true,
      refreshFailed: true,
    });
    const saved = cache.read('stellar-mainnet', 'demo.app');
    expect(saved?.detail).toEqual(previous.detail);
    expect(saved?.savedAtUnixMs).toBe(500);
    now += DAPP_DETAIL_RETRY_MS;
    response = { ...remote, launchUrls: { mainnet: 'http://127.0.0.1/', testnet: 'https://safe.example.org/' } };
    expect(await service.loadDetail('demo.app', new AbortController().signal)).toMatchObject({
      detail: previous.detail,
      fromCache: true,
      stale: true,
      refreshFailed: true,
    });
    expect(cache.read('stellar-mainnet', 'demo.app')?.detail).toEqual(previous.detail);
    service.close();
  });

  it('never issues dApp icon requests when native module is unavailable or the session is retired', async () => {
    const readIcon = jest.fn();
    const transport: SafePublicTransport = {
      available: false,
      readText: jest.fn(),
      readIcon,
      close: jest.fn(),
    };
    const service = createFchainDappPublicMedia({
      networkId: 'stellar-mainnet',
      cache: memoryCache().cache,
      transport,
    });
    expect(service.available).toBe(false);
    service.setIconsEnabled(true);
    expect(service.getIconState().enabled).toBe(false);
    await service.loadIcon(sample, new AbortController().signal);
    expect(readIcon).not.toHaveBeenCalled();
    await expect(service.loadDetail('demo.app', new AbortController().signal)).rejects.toThrow();
    service.close();
    expect(transport.close).toHaveBeenCalledTimes(1);
  });
});
