import {
  TOKEN_METADATA_TTL_MS,
  TOKEN_METADATA_FAILURE_COOLDOWN_MS,
  type TokenMetadataRepository,
  type TokenMetadataSnapshot,
} from '../../../capabilities/assets/TokenMetadataCache';
import type { AssetCatalogPort } from '../../../capabilities/trustline/curatedAssetCatalog';
import { createTokenMetadataPort } from '../TokenMetadataResolver';
import type { SafePublicTransport } from '../NativeSafePublicTransport';

const issuer = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';
const asset = { kind: 'credit' as const, code: 'Usd', issuer };
const candidate = 'https://raw.githubusercontent.com/org/icons/main/icon.png';
const issuerImage = 'https://issuer.example.org/icon.png';
const horizon = 'https://horizon.stellar.org/';
const networkPassphrase = 'Public Global Stellar Network ; September 2015';
function cache() {
  const records = new Map<string, TokenMetadataSnapshot>();
  const repository: TokenMetadataRepository = {
    read: (network, code, identity) => records.get(JSON.stringify([network, code, identity])),
    replace: jest.fn(row => records.set(JSON.stringify([row.networkId, row.code, row.issuer]), row)),
  };
  return { repository, records };
}

describe('S06 token metadata resolver', () => {
  it('requires matching network passphrase, exact issuer, then exact TOML currency before using issuer image', async () => {
    const store = cache();
    const catalog: AssetCatalogPort = {
      read: jest.fn(),
      readCachedSource: () => ({
        assets: [{ code: 'Usd', issuer, icon: candidate }],
        fromCache: true,
        stale: false,
        refreshFailed: false,
      }),
    };
    const readText = jest.fn(async (url: string) => {
      if (url === horizon) return JSON.stringify({ network_passphrase: networkPassphrase });
      if (url.includes('/accounts/')) return JSON.stringify({ account_id: issuer, home_domain: 'issuer.example.org' });
      return `[[CURRENCIES]]\ncode="Usd"\nissuer="${issuer}"\nname="Verified Issuer"\nimage="${issuerImage}"`;
    });
    const transport = { available: true, readText, readIcon: jest.fn(), close: jest.fn() } as SafePublicTransport;
    const service = createTokenMetadataPort({
      networkId: 'stellar-mainnet',
      networkPassphrase,
      horizonUrl: horizon,
      catalog,
      cache: store.repository,
      transport,
      now: () => 50_000,
    });
    const result = await service.resolve(asset, new AbortController().signal);
    expect(result.metadata).toEqual({
      name: 'Verified Issuer',
      source: 'issuer-toml',
      icons: [candidate, issuerImage],
    });
    expect(readText).toHaveBeenCalledWith(
      'https://issuer.example.org/.well-known/stellar.toml',
      expect.any(AbortSignal),
    );
    expect(store.repository.replace).toHaveBeenCalledTimes(1);
    expect(service.peek(asset)?.icons).toEqual([candidate, issuerImage]);
    await service.resolve(asset, new AbortController().signal);
    expect(readText).toHaveBeenCalledTimes(3);
    service.close();
  });

  it('rejects wrong network/issuer TOML authority and keeps curated candidates without guessing', async () => {
    const store = cache();
    const catalog: AssetCatalogPort = {
      read: jest.fn(),
      readCachedSource: () => ({
        assets: [{ code: 'Usd', issuer, icon: candidate }],
        fromCache: true,
        stale: false,
        refreshFailed: false,
      }),
    };
    const readText = jest.fn(async (url: string) =>
      url === horizon
        ? JSON.stringify({ network_passphrase: 'TESTNET' })
        : JSON.stringify({ account_id: 'GSOMEONE-ELSE', home_domain: 'evil.example.org' }),
    );
    const service = createTokenMetadataPort({
      networkId: 'stellar-mainnet',
      networkPassphrase,
      horizonUrl: horizon,
      catalog,
      cache: store.repository,
      transport: {
        available: true,
        readText,
        readIcon: jest.fn(),
        close: jest.fn(),
      },
    });
    expect((await service.resolve(asset, new AbortController().signal)).metadata?.icons).toEqual([candidate]);
    expect(readText).toHaveBeenCalledTimes(1);
    service.close();
  });

  it('maintains seven-day metadata and 24-hour negative retry cooldown without cross-network access', async () => {
    let now = 10_000;
    const store = cache();
    const readText = jest.fn(async () => {
      throw new Error('offline');
    });
    const catalog: AssetCatalogPort = { read: jest.fn(), readCachedSource: () => undefined };
    const service = createTokenMetadataPort({
      networkId: 'stellar-mainnet',
      networkPassphrase,
      horizonUrl: horizon,
      catalog,
      cache: store.repository,
      transport: { available: true, readText, readIcon: jest.fn(), close: jest.fn() },
      now: () => now,
    });
    expect((await service.resolve(asset, new AbortController().signal)).refreshFailed).toBe(true);
    await service.resolve(asset, new AbortController().signal);
    expect(readText).toHaveBeenCalledTimes(1);
    now += TOKEN_METADATA_FAILURE_COOLDOWN_MS;
    await service.resolve(asset, new AbortController().signal);
    expect(readText).toHaveBeenCalledTimes(2);
    expect(store.records.size).toBe(1);
    const other = createTokenMetadataPort({
      networkId: 'stellar-testnet',
      networkPassphrase,
      horizonUrl: horizon,
      catalog,
      cache: store.repository,
      transport: { available: true, readText, readIcon: jest.fn(), close: jest.fn() },
    });
    await expect(other.resolve(asset, new AbortController().signal)).rejects.toThrow('asset-metadata-unavailable');
    service.close();
    other.close();
    expect(TOKEN_METADATA_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });
});
