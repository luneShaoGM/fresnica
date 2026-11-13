import { estimateFiat, parseXlmQuote } from '../xlmQuote';
const now = 1794474531000;
it('binds exact currency, provider time and positive finite price', () => {
  expect(parseXlmQuote({ stellar: { usd: 0.145458, last_updated_at: now / 1000 } }, 'USD', now)).toMatchObject({
    rate: '0.14545800',
    source: 'CoinGecko',
    updatedAt: now,
  });
  for (const rate of [0, -1, NaN, Infinity, '0.1', null])
    expect(() => parseXlmQuote({ stellar: { usd: rate, last_updated_at: now / 1000 } }, 'USD', now)).toThrow();
  for (const last_updated_at of [0, now / 1000 - 301, now / 1000 + 61])
    expect(() => parseXlmQuote({ stellar: { usd: 0.1, last_updated_at } }, 'USD', now)).toThrow();
});
it('calculates display cents with exact decimal integers, including very large balances', () => {
  expect(estimateFiat('100.0000000', '0.14545800')).toBe('14.55');
  expect(estimateFiat('0.0000001', '0.14545800')).toBe('0.00');
  expect(estimateFiat('9007199254740993', '1.00000000')).toBe('9007199254740993.00');
  expect(estimateFiat('1e7', '1.00000000')).toBeUndefined();
});
