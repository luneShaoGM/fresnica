import { mapHistoryEntry } from '../../../capabilities/history/loadHistoryPage';
import type { HistoryPathPaymentEntry } from '../../../capabilities/history/types';
import { createLocalization } from '../../../locale/localization';
import { activityEntryPresentation, matchesActivityFilter, matchesActivitySearch } from '../activityList';
import { activityRowPresentation, activityAssetIdentity } from '../activityRowPresentation';

const sender = 'G' + 'A'.repeat(55);
const recipient = 'G' + 'B'.repeat(55);
const issuer = 'G' + 'C'.repeat(55);
const entry = mapHistoryEntry(
  {
    id: 'p1',
    pagingToken: '100',
    type: 'path_payment_strict_receive',
    occurredAt: '2026-11-03T00:00:00Z',
    transactionHash: 'tx-p1',
    sourceAccount: sender,
    from: sender,
    to: recipient,
    successful: true,
    sourceAmount: '922337203685.4775807',
    sourceAsset: { kind: 'native' },
    amount: '0.0000001',
    asset: { kind: 'credit', code: 'XLM', issuer },
  },
  sender,
) as HistoryPathPaymentEntry;
const { t, formatNumber } = createLocalization('en');
it.each([
  ['incoming', '+0.0000001', 'positive', 'credit'],
  ['outgoing', '−922,337,203,685.4775807', 'negative', 'native'],
  ['neutral', '0.0000001', 'neutral', 'credit'],
  ['self', '+0.0000001', 'positive', 'credit'],
] as const)('summarizes %s using the correct actual leg', (direction, amount, tone, kind) => {
  const path = { ...entry, direction };
  const row = activityRowPresentation(path, t, formatNumber, new Map([[entry.counterparty, 'Alice']]));
  expect(row.money).toMatchObject({ amount, tone, asset: { kind } });
  expect(row.title).toBe(direction === 'self' ? 'Swap' : 'Alice');
  expect(row.operation).toContain('XLM → XLM');
  expect(row.operation).toContain(direction === 'self' ? 'Swap' : 'Path payment');
  expect(activityEntryPresentation(path, t, formatNumber).filter).toBe('payments');
  expect(matchesActivityFilter(path, 'payments')).toBe(true);
  expect(matchesActivityFilter(path, 'other')).toBe(false);
});
it('keeps same-asset self paths as path payment and keys pair by issuer identity', () => {
  const same = { ...entry, direction: 'self' as const, destinationAsset: entry.sourceAsset };
  expect(activityRowPresentation(same, t, formatNumber).operation).toContain('Path payment');
  const swapped = activityRowPresentation({ ...entry, direction: 'self' }, t, formatNumber);
  expect(swapped.subject.kind).toBe('asset-pair');
  expect(activityAssetIdentity(entry.sourceAsset)).not.toBe(activityAssetIdentity(entry.destinationAsset));
});
it.each([
  entry.sourceAmount,
  entry.destinationAmount,
  '922,337,203,685.4775807',
  issuer,
  sender,
  recipient,
  'XLM',
  'path_payment_strict_receive',
  'p1',
  'tx-p1',
  'Path payment',
  'Alice',
])('searches both exact legs and eligible identities: %s', query => {
  expect(matchesActivitySearch(entry, query, t, formatNumber, new Map([[sender, 'Alice']]))).toBe(true);
});
it('does not resolve a muxed counterparty through its base name', () => {
  const muxed = 'M' + 'A'.repeat(68);
  const path = {
    ...entry,
    counterparty: muxed,
    participants: [{ role: 'sender' as const, identity: muxed, baseAccount: sender }, entry.participants[1]] as const,
  };
  expect(activityRowPresentation(path, t, formatNumber, new Map([[sender, 'Alice']])).title).not.toBe('Alice');
  expect(matchesActivitySearch(path, 'Alice', t, formatNumber, new Map([[sender, 'Alice']]))).toBe(false);
  expect(matchesActivitySearch(path, muxed, t, formatNumber)).toBe(true);
});
