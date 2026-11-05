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

  it('stores only bounded display metadata and never treats candidate image URLs as trusted downloads', () => {
    expect(
      curatedSourceAssetsFromPayload({
        assets: [asset, { ...asset, code: 'USD', icon: 'http://bad.example.org/logo', name: 'N'.repeat(200) }],
      }),
    ).toEqual([asset, { code: 'USD', issuer }]);
  });
});
