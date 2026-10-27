import { matchesCuratedAssetQuery, normalizeCuratedAssets, parseManualAssetDocument } from '../curatedAssetCatalog';

const issuer = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';

describe('curated asset catalog', () => {
  it('reads code and issuer from the public list shapes', () => {
    expect(
      normalizeCuratedAssets({
        assets: [{ code: 'usdc', issuer, domain: 'centre.io' }],
        tokens: [{ asset_code: 'BTC', asset_issuer: issuer, name: 'Bitcoin' }],
        records: [{ asset: `ETH-${issuer}` }],
      }),
    ).toEqual([
      { code: 'usdc', issuer, domain: 'centre.io' },
      { code: 'BTC', issuer, name: 'Bitcoin' },
      { code: 'ETH', issuer },
    ]);
  });

  it('preserves differently cased asset identities and drops invalid records', () => {
    expect(
      normalizeCuratedAssets([
        { code: 'usd', issuer },
        { code: 'USD', issuer },
        { code: 'bad!', issuer },
        { code: 'USD', issuer: 'invalid' },
      ]),
    ).toEqual([
      { code: 'usd', issuer },
      { code: 'USD', issuer },
    ]);
  });

  it('searches code, domain and issuer and reads a stellar.toml currency table', () => {
    const asset = { code: 'USDC', issuer, domain: 'centre.io', name: 'USD Coin' };
    expect(matchesCuratedAssetQuery(asset, 'centre')).toBe(true);
    expect(matchesCuratedAssetQuery(asset, 'nope')).toBe(false);
    expect(
      parseManualAssetDocument(`
[[CURRENCIES]]
code="USDC"
issuer="${issuer}"
name="USD Coin"
`),
    ).toEqual([{ code: 'USDC', issuer, name: 'USD Coin' }]);
  });
});

it('ends currency records before unrelated TOML tables can overwrite their identity', () => {
  const other = 'GBQCD6CQXH72HGTAASZPTFPSGXXRUGKL4SPS5X7UGQYA3RN6CZWW4ZIM';
  expect(
    parseManualAssetDocument(`
[[CURRENCIES]]
code="usd"
issuer="${issuer}"
[OTHER]
code="BTC"
issuer="${other}"
[[CURRENCIES]]
code="EUR"
issuer="${issuer}"
[[DOCUMENTATION]]
code="BAD"
issuer="${other}"
`),
  ).toEqual([
    { code: 'usd', issuer },
    { code: 'EUR', issuer },
  ]);
});
