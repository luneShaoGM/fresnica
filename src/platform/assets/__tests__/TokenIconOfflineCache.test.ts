import { createTokenIconPort, TOKEN_ICON_FRESHNESS_MS } from '../TokenIconPort';
import { PublicAssetError } from '../NativeSafePublicTransport';
import type { CachedTokenIcon, TokenIconDiskCache } from '../NativeTokenIconCache';
import type { TokenMetadataPort } from '../TokenMetadataResolver';

const issuer = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';
const asset = { kind: 'credit' as const, code: 'Usd', issuer };
const primary = 'https://cdn.example.org/primary.png';
const fallback = 'https://cdn.example.org/fallback.png';
const image = { mimeType: 'image/png' as const, dataUri: 'data:image/png;base64,aGVsbG8=' };
const key = (network = 'stellar-mainnet', identity = asset) =>
  JSON.stringify([network, identity.code, identity.issuer]);
const flush = () => new Promise<void>(resolve => setImmediate(resolve));

// Port-level persistence fixture only; real file format/decoding/eviction are
// exercised separately by Android JUnit and the Swift native cache fixture.
function fixture() {
  let now = 1_000_000;
  const stored = new Map<string, CachedTokenIcon>();
  function disk(): TokenIconDiskCache {
    let enabled = false;
    return {
      setEnabled: jest.fn(value => {
        enabled = value;
        if (!value) stored.clear();
      }),
      read: jest.fn(async identity => (enabled ? stored.get(identity) : undefined)),
      write: jest.fn(async (identity, sourceUrl, bytes) => {
        if (enabled) stored.set(identity, { ...bytes, sourceUrl, savedAtUnixMs: now });
      }),
      remove: jest.fn(async identity => {
        stored.delete(identity);
      }),
      close: jest.fn(() => {
        enabled = false;
      }),
    };
  }
  function session(networkId = 'stellar-mainnet', diskCache = disk()) {
    const metadata: TokenMetadataPort = {
      peek: jest.fn(() => ({ source: 'curated', icons: [primary, fallback] })),
      resolve: jest.fn(async () => ({ fromCache: true, stale: false, refreshFailed: false })),
      retryTransientFailures: jest.fn(),
      close: jest.fn(),
    };
    const readIcon = jest.fn(async () => image);
    const diagnostic = jest.fn();
    const service = createTokenIconPort({
      networkId,
      metadata,
      diskCache,
      now: () => now,
      initialEnabled: true,
      transport: { available: true, readIcon, readText: jest.fn(), close: jest.fn() },
      onDiagnostic: diagnostic,
    });
    return { service, readIcon, metadata, diskCache, diagnostic };
  }
  return {
    stored,
    session,
    disk,
    advance: (ms: number) => {
      now += ms;
    },
    now: () => now,
  };
}

it('reuses persisted bytes after service restart offline, with exact network/code/issuer partitions', async () => {
  const f = fixture();
  const first = f.session();
  await first.service.loadIcon(asset, new AbortController().signal);
  expect(f.stored.get(key())?.sourceUrl).toBe(primary);
  first.service.close();
  expect(f.stored.has(key())).toBe(true);
  const restarted = f.session();
  restarted.service.setReadable(false);
  expect(await restarted.service.loadIcon(asset, new AbortController().signal)).toBe(image.dataUri);
  expect(restarted.service.readIcon(asset)).toBe(image.dataUri);
  expect(restarted.readIcon).not.toHaveBeenCalled();
  expect(restarted.metadata.resolve).not.toHaveBeenCalled();
  expect(await restarted.service.loadIcon({ ...asset, code: 'USD' }, new AbortController().signal)).toBeUndefined();
  expect(
    await restarted.service.loadIcon(
      { ...asset, issuer: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF' },
      new AbortController().signal,
    ),
  ).toBeUndefined();
  const testnet = f.session('stellar-testnet');
  testnet.service.setReadable(false);
  expect(await testnet.service.loadIcon(asset, new AbortController().signal)).toBeUndefined();
  expect(testnet.readIcon).not.toHaveBeenCalled();
  restarted.service.close();
  testnet.service.close();
});

it('retains stale bytes on offline startup and failed refresh without advancing saved freshness', async () => {
  const f = fixture();
  f.stored.set(key(), { ...image, sourceUrl: fallback, savedAtUnixMs: f.now() });
  f.advance(TOKEN_ICON_FRESHNESS_MS);
  const { service, readIcon, diskCache } = f.session();
  service.setReadable(false);
  expect(await service.loadIcon(asset, new AbortController().signal)).toBe(image.dataUri);
  service.setReadable(true);
  readIcon.mockRejectedValue(new PublicAssetError('transient'));
  const pending = service.loadIcon(asset, new AbortController().signal);
  expect(service.readIcon(asset)).toBe(image.dataUri);
  expect(await pending).toBe(image.dataUri);
  expect(readIcon.mock.calls).toHaveLength(2);
  expect(jest.mocked(diskCache.write)).not.toHaveBeenCalled();
  expect(f.stored.get(key())?.savedAtUnixMs).toBe(f.now() - TOKEN_ICON_FRESHNESS_MS);
  expect(service.readIcon(asset)).toBe(image.dataUri);
  service.close();
});

it('tries the persisted successful source before the original candidate order', async () => {
  const f = fixture();
  f.stored.set(key(), { ...image, sourceUrl: fallback, savedAtUnixMs: f.now() });
  f.advance(TOKEN_ICON_FRESHNESS_MS);
  const { service, readIcon } = f.session();
  expect(await service.loadIcon(asset, new AbortController().signal)).toBe(image.dataUri);
  expect(readIcon).toHaveBeenCalledTimes(1);
  expect(readIcon).toHaveBeenCalledWith(fallback, expect.any(AbortSignal));
  expect(f.stored.get(key())?.sourceUrl).toBe(fallback);
  expect(f.stored.get(key())?.savedAtUnixMs).toBe(f.now());
  service.close();
});

it('publishes known bytes before slow issuer enrichment and keeps that enrichment cancellable', async () => {
  const f = fixture();
  const { service, readIcon, metadata, diagnostic } = f.session();
  let finish!: () => void;
  let metadataSignal!: AbortSignal;
  jest.mocked(metadata.resolve).mockImplementation((_asset, signal) => {
    metadataSignal = signal;
    return new Promise(resolve => {
      finish = () => resolve({ fromCache: false, stale: false, refreshFailed: false });
    });
  });
  const controller = new AbortController();
  const pending = service.loadIcon(asset, controller.signal);
  await flush();
  expect(readIcon).toHaveBeenCalledTimes(1);
  expect(service.readIcon(asset)).toBe(image.dataUri);
  expect(metadataSignal.aborted).toBe(false);
  controller.abort();
  expect(await pending).toBeUndefined();
  expect(metadataSignal.aborted).toBe(true);
  finish();
  await flush();
  expect(diagnostic.mock.calls.flat()).toEqual(['downloaded']);
  service.close();
});

it('clears memory/disk on privacy OFF and cannot publish a late disk hydration after OFF/ON', async () => {
  const f = fixture();
  const disk = f.disk();
  let finish!: (value: CachedTokenIcon) => void;
  jest.mocked(disk.read).mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  const { service, readIcon } = f.session('stellar-mainnet', disk);
  const old = service.loadIcon(asset, new AbortController().signal);
  await flush();
  service.setEnabled(false);
  expect(await old).toBeUndefined();
  expect(service.readIcon(asset)).toBeUndefined();
  expect(disk.setEnabled).toHaveBeenLastCalledWith(false);
  service.setEnabled(true);
  finish({ ...image, sourceUrl: primary, savedAtUnixMs: f.now() });
  await flush();
  expect(service.readIcon(asset)).toBeUndefined();
  expect(readIcon).not.toHaveBeenCalled();
  await service.loadIcon(asset, new AbortController().signal);
  expect(readIcon).toHaveBeenCalledTimes(1);
  service.setEnabled(false);
  expect(f.stored.size).toBe(0);
  service.close();
});

it('ignores disk failures without poisoning good candidates or blocking online display', async () => {
  const f = fixture();
  const disk = f.disk();
  jest.mocked(disk.read).mockRejectedValue(new Error('unavailable'));
  jest.mocked(disk.write).mockRejectedValue(new Error('full'));
  const { service, readIcon, diagnostic } = f.session('stellar-mainnet', disk);
  expect(await service.loadIcon(asset, new AbortController().signal)).toBe(image.dataUri);
  expect(service.readIcon(asset)).toBe(image.dataUri);
  expect(readIcon).toHaveBeenCalledTimes(1);
  expect(diagnostic).toHaveBeenCalledWith('downloaded');
  expect(diagnostic.mock.calls.flat()).not.toContain('download-transient');
  service.close();
});

it('recovery clears only transient candidate failures, never starts loads without consumers', async () => {
  const f = fixture();
  const { service, readIcon, metadata } = f.session();
  readIcon.mockRejectedValueOnce(new PublicAssetError('blocked'));
  readIcon.mockRejectedValueOnce(new PublicAssetError('transient'));
  expect(await service.loadIcon(asset, new AbortController().signal)).toBeUndefined();
  const before = service.getSnapshot().retryRevision;
  service.setReadable(false);
  service.setReadable(true);
  expect(service.getSnapshot().retryRevision).toBe(before + 2);
  expect(metadata.retryTransientFailures).toHaveBeenCalledTimes(1);
  expect(readIcon).toHaveBeenCalledTimes(2);
  expect(await service.loadIcon(asset, new AbortController().signal)).toBe(image.dataUri);
  expect(readIcon).toHaveBeenLastCalledWith(fallback, expect.any(AbortSignal));
  expect(readIcon).toHaveBeenCalledTimes(3);
  service.setReadable(true);
  expect(service.getSnapshot().retryRevision).toBe(before + 2);
  service.close();
});

it('keeps disk consent through an unsupported network and still clears on actual privacy OFF', () => {
  const f = fixture();
  f.stored.set(key(), { ...image, sourceUrl: primary, savedAtUnixMs: f.now() });
  const { service, diskCache } = f.session('custom-network');
  expect(service.getSnapshot().enabled).toBe(false);
  expect(diskCache.setEnabled).toHaveBeenLastCalledWith(true);
  expect(f.stored.has(key())).toBe(true);
  service.setEnabled(false);
  expect(diskCache.setEnabled).toHaveBeenLastCalledWith(false);
  expect(f.stored.size).toBe(0);
  service.close();
});

it('rehydrates from disk before network slots occupied by unrelated slow assets', async () => {
  const f = fixture();
  f.stored.set(key(), { ...image, sourceUrl: primary, savedAtUnixMs: f.now() });
  const { service, readIcon } = f.session();
  readIcon.mockImplementation(() => new Promise(() => undefined));
  const controllers = [new AbortController(), new AbortController()];
  const slow = controllers.map((controller, index) =>
    service.loadIcon({ ...asset, code: 'T' + index }, controller.signal),
  );
  await flush();
  expect(readIcon).toHaveBeenCalledTimes(2);
  expect(await service.loadIcon(asset, new AbortController().signal)).toBe(image.dataUri);
  controllers.forEach(controller => controller.abort());
  expect(await Promise.all(slow)).toEqual([undefined, undefined]);
  service.close();
});
