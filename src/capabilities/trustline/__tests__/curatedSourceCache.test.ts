import {
  CURATED_CACHE_MAX_ASSETS,
  CURATED_CACHE_TTL_MS,
  curatedSourceAssetsFromPayload,
  normalizeCuratedSourceSnapshot,
  type CuratedSourceSnapshot,
} from '../curatedSourceCache';

const issuer = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';
const asset = { code: 'Usd', issuer, name: 'USD Token', icon: 'https://assets.example.org/icon.png' };
const snapshot: CuratedSourceSnapshot = {
  schemaVersion: 1,
  networkId: 'stellar-mainnet',
  sourceId: 'lobstr',
  savedAtUnixMs: CURATED_CACHE_TTL_MS,
  assets: [asset],
};

describe('S06 curated source cache contract', () => {
  it('validates a known Mainnet source and preserves exact asset code case and issuer', () => {
    expect(normalizeCuratedSourceSnapshot(snapshot, 'stellar-mainnet', 'lobstr')).toEqual(snapshot);
    expect(normalizeCuratedSourceSnapshot(snapshot, 'stellar-testnet', 'lobstr')).toBeUndefined();
    expect(normalizeCuratedSourceSnapshot(snapshot, 'stellar-mainnet', 'soroswap')).toBeUndefined();
    expect(
      normalizeCuratedSourceSnapshot({ ...snapshot, schemaVersion: 42 }, 'stellar-mainnet', 'lobstr'),
    ).toBeUndefined();
    expect(
      normalizeCuratedSourceSnapshot({ ...snapshot, savedAtUnixMs: -1 }, 'stellar-mainnet', 'lobstr'),
    ).toBeUndefined();
    expect(
      normalizeCuratedSourceSnapshot(
        { ...snapshot, assets: [asset, { ...asset, code: 'USD' }] },
        'stellar-mainnet',
        'lobstr',
      )?.assets,
    ).toHaveLength(2);
  });

  it('rejects corrupt duplicate, oversized and mixed-identity cache rows', () => {
    expect(
      normalizeCuratedSourceSnapshot({ ...snapshot, assets: [asset, asset] }, 'stellar-mainnet', 'lobstr'),
    ).toBeUndefined();
    expect(
      normalizeCuratedSourceSnapshot(
        { ...snapshot, assets: [{ ...asset, issuer: 'invalid' }] },
        'stellar-mainnet',
        'lobstr',
      ),
    ).toBeUndefined();
    expect(
      normalizeCuratedSourceSnapshot(
        { ...snapshot, assets: [{ ...asset, icon: 'http://localhost/logo' }] },
        'stellar-mainnet',
        'lobstr',
      ),
    ).toBeUndefined();
    expect(
      normalizeCuratedSourceSnapshot(
        { ...snapshot, assets: Array(CURATED_CACHE_MAX_ASSETS + 1).fill(asset) },
        'stellar-mainnet',
        'lobstr',
      ),
    ).toBeUndefined();
  });

  it('accepts authentic empty catalog lists, not malformed empty-looking payloads', () => {
    expect(curatedSourceAssetsFromPayload([])).toEqual([]);
    expect(curatedSourceAssetsFromPayload({ assets: [] })).toEqual([]);
    expect(curatedSourceAssetsFromPayload({ _embedded: { records: [] } })).toEqual([]);
    expect(() => curatedSourceAssetsFromPayload({ failed: true })).toThrow('curated-source-invalid');
    expect(() => curatedSourceAssetsFromPayload({ assets: [{ code: 'broken!' }] })).toThrow('curated-source-invalid');
    expect(() => curatedSourceAssetsFromPayload({ _embedded: { records: [{ error: 'upstream' }] } })).toThrow(
      'curated-source-invalid',
    );
  });

  it('accepts the real Soroswap mixed contract-only shape without discarding valid credit icons', () => {
    const contractOnly = {
      code: 'JQQQ',
      contract: 'CAQYPRTX2E6H6BM57QRBYZWP667FPDYDUHMOQXGXM2HA64KO6AISRFEK',
      icon: 'https://assets.example.org/contract.png',
      decimals: 18,
    };
    expect(curatedSourceAssetsFromPayload({ assets: [asset, contractOnly] }, 'soroswap')).toEqual([asset]);
    expect(() => curatedSourceAssetsFromPayload({ assets: [asset, contractOnly] }, 'lobstr'))
      .toThrow('curated-source-invalid');
    expect(() => curatedSourceAssetsFromPayload({
      assets: [asset, { ...contractOnly, issuer: 'not-an-issuer' }],
    }, 'soroswap')).toThrow('curated-source-invalid');
    expect(() => curatedSourceAssetsFromPayload({
      assets: [asset, { ...contractOnly, contract: 'bad' }],
    }, 'soroswap')).toThrow('curated-source-invalid');
    expect(() => curatedSourceAssetsFromPayload({
      assets: [asset, contractOnly, { error: 'upstream' }],
    }, 'soroswap')).toThrow('curated-source-invalid');
  });

  it('rejects mixed valid and malformed rows across all supported asset-list shapes', () => {
    const malformed = { code: 'broken!', issuer };
    for (const payload of [
      { assets: [asset, malformed] },
      { tokens: [asset, malformed] },
      { records: [asset, malformed] },
      { _embedded: { records: [asset, malformed] } },
      [asset, malformed],
    ]) {
      expect(() => curatedSourceAssetsFromPayload(payload)).toThrow('curated-source-invalid');
    }
    // Mixed data must not be silently reduced to a plausible but incomplete list.
    expect(() => curatedSourceAssetsFromPayload({ assets: [asset, { error: 'upstream' }] })).toThrow(
      'curated-source-invalid',
    );
    // Alternate valid source identity shapes still parse; this strictness
    // applies to corrupted entries rather than treating all variants as bad.
    expect(
      curatedSourceAssetsFromPayload({
        assets: [asset],
        tokens: [{ asset_code: 'BTC', asset_issuer: issuer }],
        records: [{ asset: `ETH-${issuer}` }],
      }),
    ).toEqual([asset, { code: 'BTC', issuer }, { code: 'ETH', issuer }]);
  });

  it('stores only bounded display metadata and never treats candidate image URLs as trusted downloads', () => {
    expect(
      curatedSourceAssetsFromPayload({
        assets: [asset, { ...asset, code: 'USD', icon: 'http://bad.example.org/logo', name: 'N'.repeat(200) }],
      }),
    ).toEqual([asset, { code: 'USD', issuer }]);
  });
});
