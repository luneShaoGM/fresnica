import { assetSelectionKey, matchesAssetSearch, sendSelectableBalances } from '../assetSelection';
const native = { kind: 'native', code: 'XLM' } as const;
const usd = { kind: 'credit', code: 'USD', issuer: 'GISSUER' } as const;
it('searches code and issuer case-insensitively and preserves issuer identity', () => {
  expect(matchesAssetSearch(usd, ' usd ')).toBe(true);
  expect(matchesAssetSearch(usd, 'gissuer')).toBe(true);
  expect(matchesAssetSearch(native, 'xlm')).toBe(true);
  expect(matchesAssetSearch(usd, 'EUR')).toBe(false);
  expect(matchesAssetSearch(usd, '  ')).toBe(true);
  expect(assetSelectionKey(usd)).not.toBe(assetSelectionKey({ ...usd, issuer: 'GOTHER' }));
});
it('keeps native and positive credit balances, including the smallest unit', () => {
  const lines = [
    { asset: native, balance: '0' },
    { asset: usd, balance: '0.0000001' },
    { asset: { ...usd, issuer: 'GZERO' }, balance: '0.0000000' },
  ];
  expect(sendSelectableBalances(lines)).toEqual(lines.slice(0, 2));
});
