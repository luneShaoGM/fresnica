import type { BalanceLine } from '../../balance/types';
import { walletAssetKey } from '../../assets/walletAssetIdentity';
import { loadPortfolioReference } from '../portfolioReference';
import type { CreditFiatQuote } from '../creditFiatQuote';

const now = 1_000_000;
const issuerA = 'G' + 'A'.repeat(55);
const issuerB = 'G' + 'B'.repeat(55);
const native: BalanceLine = { asset: { kind: 'native', code: 'XLM' }, balance: '0.0000001' };
const credit = (issuer: string, balance = '0.0000001'): BalanceLine => ({
  asset: { kind: 'credit', code: 'USD', issuer },
  balance,
});
const xlm = {
  load: jest.fn(async () => ({
    currency: 'USD' as const,
    rate: '1.00000000',
    updatedAt: now,
    source: 'CoinGecko' as const,
  })),
};
const quote = (issuer: string): CreditFiatQuote => ({
  networkId: 'stellar-mainnet',
  assetKey: walletAssetKey('stellar-mainnet', { kind: 'credit', code: 'USD', issuer }),
  currency: 'USD',
  xlmPerUnit: '1.0000000',
  xlmFiatRate: '1.00000000',
  quotedAt: now,
  expiresAt: now + 30_000,
});
const signal = () => new AbortController().signal;

beforeEach(() => xlm.load.mockClear());

it('aggregates exact sub-cent Classic amounts before one cent rounding, keeping same-code issuers distinct', async () => {
  const load = jest.fn(async (asset: { issuer: string }) => quote(asset.issuer));
  const result = await loadPortfolioReference(
    [native, credit(issuerA, '0.0049999'), credit(issuerB, '0.0000001')],
    'stellar-mainnet',
    'USD',
    { xlm, credit: { load } },
    signal(),
    () => now,
  );
  expect(result).toMatchObject({ cents: '0.01', covered: 3, total: 3, missing: [] });
  expect(load.mock.calls.map(([asset]) => asset.issuer)).toEqual([issuerA, issuerB]);
});

it('labels missing quotes and the request cap as partial without turning absence into zero', async () => {
  const lines = Array.from({ length: 10 }, (_, i) => credit('G' + String.fromCharCode(65 + i).repeat(55)));
  const load = jest.fn(async () => {
    throw new Error('no-route');
  });
  const result = await loadPortfolioReference(
    lines,
    'stellar-mainnet',
    'USD',
    { xlm, credit: { load } },
    signal(),
    () => now,
  );
  expect(result).toMatchObject({ covered: 0, total: 10 });
  expect(result.cents).toBeUndefined();
  expect(result.missing.filter(item => item.reason === 'budget')).toHaveLength(2);
  expect(result.missing.filter(item => item.reason === 'no-price')).toHaveLength(8);
  expect(load).toHaveBeenCalledTimes(8);
});

it('rejects Testnet and stale or wrong-issuer quote results', async () => {
  const load = jest.fn(async () => quote(issuerB));
  await expect(
    loadPortfolioReference([credit(issuerA)], 'stellar-testnet', 'USD', { xlm, credit: { load } }, signal(), () => now),
  ).rejects.toThrow('portfolio-unavailable');
  expect(load).not.toHaveBeenCalled();
  const result = await loadPortfolioReference(
    [credit(issuerA)],
    'stellar-mainnet',
    'USD',
    { xlm, credit: { load } },
    signal(),
    () => now,
  );
  expect(result.cents).toBeUndefined();
  expect(result.missing).toEqual([
    { key: walletAssetKey('stellar-mainnet', credit(issuerA).asset), reason: 'no-price' },
  ]);
  load.mockImplementation(async () => ({ ...quote(issuerA), expiresAt: now }));
  const stale = await loadPortfolioReference(
    [credit(issuerA)],
    'stellar-mainnet',
    'USD',
    { xlm, credit: { load } },
    signal(),
    () => now,
  );
  expect(stale.cents).toBeUndefined();
});

it('retires a late result after abort', async () => {
  let complete!: (value: CreditFiatQuote) => void;
  const load = jest.fn(
    () =>
      new Promise<CreditFiatQuote>(resolve => {
        complete = resolve;
      }),
  );
  const controller = new AbortController();
  const pending = loadPortfolioReference(
    [credit(issuerA)],
    'stellar-mainnet',
    'USD',
    { xlm, credit: { load } },
    controller.signal,
    () => now,
  );
  await Promise.resolve();
  controller.abort();
  complete(quote(issuerA));
  await expect(pending).rejects.toThrow('portfolio-retired');
});

it('marks conflicting duplicate balances invalid instead of using an arbitrary amount', async () => {
  const load = jest.fn(async () => quote(issuerA));
  const result = await loadPortfolioReference(
    [credit(issuerA, '1'), credit(issuerA, '2')],
    'stellar-mainnet',
    'USD',
    { xlm, credit: { load } },
    signal(),
    () => now,
  );
  expect(result).toMatchObject({
    covered: 0,
    total: 1,
    missing: [{ key: walletAssetKey('stellar-mainnet', credit(issuerA).asset), reason: 'invalid' }],
  });
  expect(load).not.toHaveBeenCalled();
});
it('stops scheduling further quotes once the request is retired', async () => {
  const controller = new AbortController();
  const load = jest.fn(async (asset: { issuer: string }) => {
    controller.abort();
    return quote(asset.issuer);
  });
  await expect(
    loadPortfolioReference(
      [credit(issuerA), credit(issuerB), credit('G' + 'C'.repeat(55))],
      'stellar-mainnet',
      'USD',
      { xlm, credit: { load } },
      controller.signal,
      () => now,
    ),
  ).rejects.toThrow('portfolio-retired');
  expect(load).toHaveBeenCalledTimes(1);
});
