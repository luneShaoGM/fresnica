import type { HistoryEntry } from '../../../capabilities/history/types';
import { entryAssetIdentities, visibleByAssetPreference } from '../activityAssetVisibility';

const issuer = 'G' + 'A'.repeat(55);
const otherIssuer = 'G' + 'B'.repeat(55);
const asset = { kind: 'credit' as const, code: 'USD', issuer };
const alt = { kind: 'credit' as const, code: 'USD', issuer: otherIssuer };
const native = { kind: 'native' as const, code: 'XLM' };

function row(partial: object): HistoryEntry {
  return {
    id: '1',
    pagingToken: '1',
    operationType: 'payment',
    occurredAt: '2026-11-04T00:00:00Z',
    transactionHash: 'tx1',
    sourceAccount: 'GACCOUNT',
    ...partial,
  } as HistoryEntry;
}

const payment = row({
  kind: 'payment',
  asset,
  amount: '0.0000001',
  counterparty: 'GPEER',
  direction: 'incoming',
});

it('defaults to all visible and only hides an exact manually selected issuer', () => {
  const [identity] = entryAssetIdentities(payment);
  expect(identity).toBe(JSON.stringify(['USD', issuer]));
  expect(visibleByAssetPreference(payment, new Set(), false)).toBe(true);
  const hidden = new Set([identity]);
  expect(visibleByAssetPreference(payment, hidden, false)).toBe(false);
  expect(visibleByAssetPreference(payment, hidden, true)).toBe(true);
  expect(visibleByAssetPreference(row({ ...payment, asset: alt }), hidden, false)).toBe(true);
  expect(visibleByAssetPreference(row({ ...payment, asset: native }), hidden, false)).toBe(true);
});

it('does not infer Dust/Spam from a dust-sized amount, issuer, unknown or failed record', () => {
  expect(entryAssetIdentities(payment)).toHaveLength(1);
  expect(entryAssetIdentities(row({ kind: 'unsupported', reason: 'operation-type' }))).toEqual([]);
  expect(entryAssetIdentities(row({ kind: 'failed', successful: false }))).toEqual([]);
  expect(visibleByAssetPreference(payment, new Set(), false)).toBe(true);
});

it('hides only explicitly associated asset transactions and leaves ledger detail untouched', () => {
  const swap = row({
    kind: 'path-payment',
    sourceAsset: asset,
    destinationAsset: alt,
    sourceAmount: '1',
    destinationAmount: '0.9',
    direction: 'outgoing',
    counterparty: 'GPEER',
  });
  const identities = entryAssetIdentities(swap);
  expect(identities).toHaveLength(2);
  expect(visibleByAssetPreference(swap, new Set([identities[0]]), false)).toBe(false);
  expect(visibleByAssetPreference(swap, new Set(), false)).toBe(true);
  expect(visibleByAssetPreference(swap, new Set([identities[0]]), true)).toBe(true);
});
