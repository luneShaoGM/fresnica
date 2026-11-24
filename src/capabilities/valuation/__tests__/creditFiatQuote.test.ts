import { createCreditFiatQuotes, creditQuoteCurrent, estimateCreditFiat, type CreditAsset } from '../creditFiatQuote';
import { NETWORKS } from '../../network/networkPreferences';
import type { PathPaymentRoute } from '../../path-payment/types';
import type { XlmQuote } from '../xlmQuote';

const asset: CreditAsset = { kind: 'credit', code: 'USD', issuer: 'GISSUER_A' };
const other: CreditAsset = { ...asset, issuer: 'GISSUER_B' };
const now = 1_800_000_000_000;
const xlm: XlmQuote = { currency: 'USD', rate: '0.50000000', updatedAt: now, source: 'CoinGecko' };
const route: PathPaymentRoute = {
  sourceAsset: asset,
  sourceAmount: '1.0000000',
  destinationAsset: { kind: 'native' },
  destinationAmount: '2.0000000',
  path: [],
};

function fixture() {
  const gateway = {
    network: NETWORKS['stellar-mainnet'],
    loadStrictSendPaths: jest.fn(async () => [route]),
    loadStrictReceivePaths: jest.fn(),
  };
  const loadXlm = jest.fn(async () => xlm);
  const clock = jest.fn(() => now);
  const quotes = createCreditFiatQuotes({
    gateway,
    xlmQuotes: { load: loadXlm },
    isClassicAccountAddress: address => address.startsWith('GISSUER_'),
    now: clock,
  });
  return { gateway, loadXlm, clock, quotes };
}
const signal = () => new AbortController().signal;

it('prices only the exact issued asset with a fixed one-unit public lookup and chooses the best valid route', async () => {
  const f = fixture();
  f.gateway.loadStrictSendPaths.mockResolvedValueOnce([route, { ...route, destinationAmount: '3.0000000' }]);
  const quote = await f.quotes.load(asset, 'USD', signal());
  expect(f.gateway.loadStrictSendPaths).toHaveBeenCalledWith({
    sourceAsset: asset,
    sourceAmount: '1.0000000',
    destinationAssets: [{ kind: 'native' }],
  });
  expect(quote.xlmPerUnit).toBe('3.0000000');
  expect(estimateCreditFiat('10.0000000', quote)).toBe('15.00');
  expect(creditQuoteCurrent(quote, other, 'USD', now)).toBe(false);
  expect(creditQuoteCurrent(quote, asset, 'EUR', now)).toBe(false);
  expect(creditQuoteCurrent(quote, asset, 'USD', now + 29_999)).toBe(true);
  expect(creditQuoteCurrent(quote, asset, 'USD', now + 30_000)).toBe(false);
  expect(creditQuoteCurrent(quote, asset, 'USD', now - 1)).toBe(false);
});

it.each([
  { ...route, sourceAsset: other },
  { ...route, sourceAmount: '2' },
  { ...route, destinationAsset: other },
  { ...route, destinationAmount: '0' },
  { ...route, destinationAmount: '1e3' },
  { ...route, destinationAmount: '999999999999999999999999' },
])('rejects a malformed or mismatched route', async invalid => {
  const f = fixture();
  f.gateway.loadStrictSendPaths.mockResolvedValueOnce([invalid]);
  await expect(f.quotes.load(asset, 'USD', signal())).rejects.toThrow();
});

it('does not turn missing routes into a zero quote', async () => {
  const f = fixture();
  f.gateway.loadStrictSendPaths.mockResolvedValueOnce([]);
  await expect(f.quotes.load(asset, 'USD', signal())).rejects.toThrow('credit-quote-unavailable');
});

it('reuses only fresh per-issuer and per-currency public quotes', async () => {
  const f = fixture();
  await f.quotes.load(asset, 'USD', signal());
  await f.quotes.load(asset, 'USD', signal());
  expect(f.gateway.loadStrictSendPaths).toHaveBeenCalledTimes(1);
  f.gateway.loadStrictSendPaths.mockResolvedValueOnce([{ ...route, sourceAsset: other }]);
  await f.quotes.load(other, 'USD', signal());
  expect(f.gateway.loadStrictSendPaths).toHaveBeenCalledTimes(2);
  f.clock.mockReturnValue(now + 30_000);
  f.loadXlm.mockResolvedValue({ ...xlm, updatedAt: now + 30_000 });
  await f.quotes.load(asset, 'USD', signal());
  expect(f.gateway.loadStrictSendPaths).toHaveBeenCalledTimes(3);
});

it('rejects stale reference prices before a market request and bounds quote expiry by both inputs', async () => {
  const f = fixture();
  f.loadXlm.mockResolvedValueOnce({ ...xlm, updatedAt: now - 300_000 });
  await expect(f.quotes.load(asset, 'USD', signal())).rejects.toThrow();
  expect(f.gateway.loadStrictSendPaths).not.toHaveBeenCalled();
  f.loadXlm.mockResolvedValueOnce({ ...xlm, updatedAt: now - 299_000 });
  const quote = await f.quotes.load(asset, 'USD', signal());
  expect(quote.expiresAt).toBe(now + 1000);
});

it('ignores cancellation and late prices', async () => {
  const f = fixture();
  const controller = new AbortController();
  f.gateway.loadStrictSendPaths.mockImplementationOnce(async () => {
    controller.abort();
    return [route];
  });
  await expect(f.quotes.load(asset, 'USD', controller.signal)).rejects.toThrow();
  f.clock.mockReturnValueOnce(now).mockReturnValueOnce(now + 30_000);
  await expect(f.quotes.load(asset, 'USD', signal())).rejects.toThrow();
});

it('does exact decimal multiplication before rounding to cents', async () => {
  const f = fixture();
  const quote = await f.quotes.load(asset, 'USD', signal());
  expect(estimateCreditFiat('0.005', quote)).toBe('0.01');
  expect(estimateCreditFiat('0.0049999', quote)).toBe('0.00');
  expect(estimateCreditFiat('922337203685.4775807', quote)).toBe('922337203685.48');
  expect(estimateCreditFiat('-1', quote)).toBeUndefined();
  expect(estimateCreditFiat('1e9', quote)).toBeUndefined();
});

it('makes no fiat or market request on a different network or malformed asset', async () => {
  const f = fixture();
  const testnet = createCreditFiatQuotes({
    gateway: { ...f.gateway, network: NETWORKS['stellar-testnet'] },
    xlmQuotes: { load: f.loadXlm },
    isClassicAccountAddress: () => true,
    now: f.clock,
  });
  await expect(testnet.load(asset, 'USD', signal())).rejects.toThrow();
  await expect(f.quotes.load({ ...asset, code: 'bad:code' }, 'USD', signal())).rejects.toThrow();
  expect(f.loadXlm).not.toHaveBeenCalled();
  expect(f.gateway.loadStrictSendPaths).not.toHaveBeenCalled();
});
