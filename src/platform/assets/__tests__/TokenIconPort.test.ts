import { createTokenIconPort } from '../TokenIconPort';
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
  it('does not request any remote image before explicit Mainnet consent', async () => {
    const { icons, readIcon } = setup();
    expect(icons.getSnapshot().enabled).toBe(false);
    expect(await icons.loadIcon(asset, new AbortController().signal)).toBeUndefined();
    expect(readIcon).not.toHaveBeenCalled();
    expect(icons.readIcon(asset)).toBeUndefined();
    icons.close();
  });

  it('fails closed when native transport is absent or network is not Mainnet', async () => {
    for (const { network, native } of [
      { network: 'stellar-testnet', native: true },
      { network: 'stellar-mainnet', native: false },
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
    await Promise.resolve();
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
