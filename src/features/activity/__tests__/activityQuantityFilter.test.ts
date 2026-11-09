import type { HistoryEntry } from '../../../capabilities/history/types';
import { matchesActivityQuantity } from '../activityQuantityFilter';
const native = { kind: 'native', code: 'XLM' };
const usd = { kind: 'credit', code: 'USD', issuer: 'GISSUER' };
const identity = JSON.stringify(['USD', 'GISSUER']);
function row(changes: object = {}): HistoryEntry {
  return {
    id: '1',
    pagingToken: '1',
    occurredAt: '2026-11-09T00:00:00Z',
    transactionHash: 'tx',
    sourceAccount: 'GSELF',
    kind: 'payment',
    successful: true,
    operationType: 'payment',
    direction: 'incoming',
    asset: usd,
    amount: '25',
    ...changes,
  } as HistoryEntry;
}
it('compares exact actual quantities inclusively, rejects malformed amounts, and requires both controls', () => {
  expect(matchesActivityQuantity(row(), { comparison: 'at-most', amount: '25' })).toBe(true);
  expect(matchesActivityQuantity(row(), { comparison: 'at-least', amount: '25' })).toBe(true);
  expect(matchesActivityQuantity(row({ amount: '25.0000001' }), { comparison: 'at-most', amount: '25' })).toBe(false);
  expect(matchesActivityQuantity(row({ amount: '24.9999999' }), { comparison: 'at-least', amount: '25' })).toBe(false);
  expect(
    matchesActivityQuantity(row({ amount: '922337203685.4775807' }), { comparison: 'at-least', amount: '1000' }),
  ).toBe(true);
  for (const amount of ['NaN', '1e5', '-1', '0', '25.00000001'])
    expect(matchesActivityQuantity(row({ amount }), { comparison: 'at-most', amount: '25' })).toBe(false);
  expect(matchesActivityQuantity(row({ kind: 'failed', successful: false }), { comparison: 'at-most' })).toBe(true);
});
it('matches an exact issuer and binds direction, asset and amount to the same path leg', () => {
  const swap = row({
    kind: 'path-payment',
    direction: 'self',
    sourceAsset: usd,
    sourceAmount: '50',
    destinationAsset: native,
    destinationAmount: '5',
  });
  expect(matchesActivityQuantity(swap, { asset: identity, comparison: 'at-most', amount: '10' })).toBe(false);
  expect(matchesActivityQuantity(swap, { asset: identity, direction: 'incoming' })).toBe(false);
  expect(
    matchesActivityQuantity(swap, { asset: 'native:XLM', direction: 'incoming', comparison: 'at-most', amount: '10' }),
  ).toBe(true);
  expect(matchesActivityQuantity(swap, { asset: JSON.stringify(['USD', 'GOTHER']) })).toBe(false);
});
it('never treats offer intent, trust limits, share counts, failed or unknown money as applied value', () => {
  for (const changes of [
    { kind: 'failed', successful: false },
    { successful: undefined },
    { kind: 'offer', buyingAsset: usd, sellingAsset: native },
    { kind: 'change-trust', limit: '25' },
  ]) {
    expect(matchesActivityQuantity(row(changes), { comparison: 'at-most', amount: '1000' })).toBe(false);
    expect(matchesActivityQuantity(row(changes), { direction: 'incoming' })).toBe(false);
  }
  const burn = row({ kind: 'claimable-reference', operationType: 'clawback_claimable_balance' });
  expect(matchesActivityQuantity(burn, { direction: 'incoming' })).toBe(false);
  expect(matchesActivityQuantity(burn, { asset: identity, comparison: 'at-least', amount: '25' })).toBe(true);
});

it('retains the contract i128 quantity domain for direction and amount without widening classic payments', () => {
  const maximum = '17014118346046923173168730371588.4105727';
  const event = { type: 'mint', asset: usd, amount: maximum, direction: 'incoming', to: 'GSELF' };
  const contract = row({ kind: 'contract', operationType: 'invoke_host_function', events: [event] });
  expect(matchesActivityQuantity(contract, { direction: 'incoming' })).toBe(true);
  expect(
    matchesActivityQuantity(contract, {
      asset: identity,
      direction: 'incoming',
      comparison: 'at-least',
      amount: '1000',
    }),
  ).toBe(true);
  expect(matchesActivityQuantity(contract, { comparison: 'at-most', amount: '1000' })).toBe(false);
  expect(
    matchesActivityQuantity(
      row({ kind: 'contract', events: [{ ...event, amount: '17014118346046923173168730371588.4105728' }] }),
      { direction: 'incoming' },
    ),
  ).toBe(false);
  expect(matchesActivityQuantity(row({ amount: maximum }), { direction: 'incoming' })).toBe(false);
  expect(
    matchesActivityQuantity(row({ kind: 'contract', events: [{ ...event, amount: '0' }] }), { direction: 'incoming' }),
  ).toBe(false);
});
