import { createHttpActivityAssetImages } from '../HttpActivityAssetImages';
import type { AssetCatalogPort } from '../../../capabilities/trustline/curatedAssetCatalog';

const issuerA = 'G' + 'A'.repeat(55);
const issuerB = 'G' + 'B'.repeat(55);
const asset = { kind: 'credit' as const, code: 'USDC', issuer: issuerA };
const icon = 'https://images.example.org/token.png';

function png(width = 24, height = 24): Uint8Array {
  const bytes = new Uint8Array(33);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]);
  new DataView(bytes.buffer).setUint32(16, width);
  new DataView(bytes.buffer).setUint32(20, height);
  return bytes;
}

function response(bytes: Uint8Array, url = icon) {
  return {
    ok: true,
    redirected: false,
    url,
    headers: { get: () => null },
    arrayBuffer: async () => bytes.buffer,
  } as unknown as Response;
}

const signal = () => new AbortController().signal;

describe('opt-in Activity asset images', () => {
  const catalog = (items: unknown[]): AssetCatalogPort => ({
    read: jest.fn(async () => JSON.stringify({ assets: items })),
  });

  it('never contacts catalog on Testnet, custom network or native XLM', async () => {
    const source = catalog([{ code: asset.code, issuer: asset.issuer, icon }]);
    const http = jest.fn(async () => response(png()));
    const port = createHttpActivityAssetImages(source, http as unknown as typeof fetch);
    expect(await port.resolve('stellar-testnet', asset, signal())).toBeUndefined();
    expect(await port.resolve('stellar-mainnet', { kind: 'native', code: 'XLM' }, signal())).toBeUndefined();
    expect(await port.resolve('custom', asset, signal())).toBeUndefined();
    expect(source.read).not.toHaveBeenCalled();
    expect(http).not.toHaveBeenCalled();
  });

  it('uses exact code and issuer, returns inline image and reuses bounded transient cache', async () => {
    const source = catalog([
      { code: 'USDC', issuer: issuerB, icon: 'https://images.example.org/wrong.png' },
      { code: 'usdc', issuer: issuerA, icon: 'https://images.example.org/other.png' },
      { code: asset.code, issuer: asset.issuer, icon },
    ]);
    const http = jest.fn(async () => response(png()));
    let clock = 100;
    const port = createHttpActivityAssetImages(source, http as unknown as typeof fetch, () => clock);
    const first = await port.resolve('stellar-mainnet', asset, signal());
    expect(first).toMatch(/^data:image\/png;base64,/);
    expect(http).toHaveBeenCalledWith(icon, expect.objectContaining({ redirect: 'error', credentials: 'omit' }));
    expect(await port.resolve('stellar-mainnet', asset, signal())).toBe(first);
    expect(http).toHaveBeenCalledTimes(1);
    clock += 600_001;
    expect(await port.resolve('stellar-mainnet', asset, signal())).toMatch(/^data:image\/png;base64,/);
    expect(http).toHaveBeenCalledTimes(2);
  });

  it.each([
    'http://images.example.org/icon.png',
    'https://localhost/icon.png',
    'https://192.168.0.1/icon.png',
    'https://images.example.org:444/icon.png',
    'https://images.example.org/icon.png#token',
  ])('does not fetch an unsafe image URL %s', async unsafe => {
    const source = catalog([{ code: asset.code, issuer: asset.issuer, icon: unsafe }]);
    const http = jest.fn(async () => response(png()));
    expect(
      await createHttpActivityAssetImages(source, http as unknown as typeof fetch).resolve(
        'stellar-mainnet',
        asset,
        signal(),
      ),
    ).toBeUndefined();
    expect(http).not.toHaveBeenCalled();
  });

  it('fails closed on oversized, wrong dimensions, redirects or unsupported bytes', async () => {
    for (const result of [
      response(png(513, 24)),
      response(new Uint8Array([1, 2, 3, 4])),
      { ...response(png()), redirected: true },
      response(new Uint8Array(65_537)),
    ]) {
      const source = catalog([{ code: asset.code, issuer: asset.issuer, icon }]);
      const port = createHttpActivityAssetImages(source, jest.fn(async () => result) as unknown as typeof fetch);
      expect(await port.resolve('stellar-mainnet', asset, signal())).toBeUndefined();
    }
  });

  it('rejects conflicting public catalog images for the exact same asset', async () => {
    const source = catalog([
      { code: asset.code, issuer: asset.issuer, icon },
      { code: asset.code, issuer: asset.issuer, icon: 'https://images.example.org/other.png' },
    ]);
    const http = jest.fn(async () => response(png()));
    const port = createHttpActivityAssetImages(source, http as unknown as typeof fetch);
    expect(await port.resolve('stellar-mainnet', asset, signal())).toBeUndefined();
    expect(http).not.toHaveBeenCalled();
  });

  it('bounds concurrent image transports to two and services a queued request', async () => {
    const source = catalog([{ code: asset.code, issuer: asset.issuer, icon }]);
    const resolvers: Array<(result: Response) => void> = [];
    const http = jest.fn(() => new Promise<Response>(resolve => resolvers.push(resolve))) as unknown as typeof fetch;
    const port = createHttpActivityAssetImages(source, http);
    const requests = [
      port.resolve('stellar-mainnet', asset, signal()),
      port.resolve('stellar-mainnet', asset, signal()),
      port.resolve('stellar-mainnet', asset, signal()),
    ];
    for (let i = 0; i < 20; i++) await Promise.resolve();
    expect(http).toHaveBeenCalledTimes(2);
    resolvers.shift()?.(response(png()));
    for (let i = 0; i < 20; i++) await Promise.resolve();
    expect(http).toHaveBeenCalledTimes(3);
    resolvers.shift()?.(response(png()));
    resolvers.shift()?.(response(png()));
    expect((await Promise.all(requests)).every(result => result?.startsWith('data:image/png;'))).toBe(true);
  });

  it('returns after the six-second deadline even if a transport ignores abort', async () => {
    jest.useFakeTimers();
    try {
      const source = catalog([{ code: asset.code, issuer: asset.issuer, icon }]);
      const http = jest.fn(() => new Promise<Response>(() => undefined)) as unknown as typeof fetch;
      const port = createHttpActivityAssetImages(source, http);
      const pending = port.resolve('stellar-mainnet', asset, signal());
      for (let i = 0; i < 20; i++) await Promise.resolve();
      jest.advanceTimersByTime(6_000);
      await expect(pending).resolves.toBeUndefined();
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not return or cache an image after opt-out cancellation and limits active fetches', async () => {
    const source = catalog([{ code: asset.code, issuer: asset.issuer, icon }]);
    const pending: { resolve: (result: Response) => void }[] = [];
    const http = jest.fn(() => new Promise<Response>(resolve => pending.push({ resolve }))) as unknown as typeof fetch;
    const port = createHttpActivityAssetImages(source, http);
    const first = new AbortController();
    const firstLoad = port.resolve('stellar-mainnet', asset, first.signal);
    // Let catalog promises resolve before the HTTP transport is reached.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    first.abort();
    while (pending.length === 0) await Promise.resolve();
    pending.shift()?.resolve(response(png()));
    expect(await firstLoad).toBeUndefined();
    // No cancelled image was cached.
    expect(await port.resolve('stellar-testnet', asset, signal())).toBeUndefined();
  });
});
