import type { AccountRecord } from '../../account/types';
import type { HistoryOperationRecord } from '../HistoryGateway';
import { normalizeHistoryCacheSnapshot } from '../HistoryCacheRepository';
import { mapHistoryEntry } from '../loadHistoryPage';
import { loadHistoryOperationDetails } from '../loadHistoryOperationDetails';
import { isPathSwap } from '../pathPaymentHistory';

const sender = 'G' + 'A'.repeat(55);
const recipient = 'G' + 'B'.repeat(55);
const issuer = 'G' + 'C'.repeat(55);
const record: HistoryOperationRecord = {
  id: 'path-1',
  pagingToken: '100',
  type: 'path_payment_strict_send',
  occurredAt: '2026-11-03T00:00:00Z',
  transactionHash: 'tx-path',
  sourceAccount: sender,
  successful: true,
  from: sender,
  to: recipient,
  sourceAmount: '922337203685.4775807',
  sourceAsset: { kind: 'native' },
  amount: '0.0000001',
  asset: { kind: 'credit', code: 'USD', issuer },
};
const snapshot = (entry = mapHistoryEntry(record, sender)) => ({
  schemaVersion: 1 as const,
  lastSuccessfulHorizonUpdateAt: new Date('2026-11-03'),
  entries: [entry],
  details: [{ operationId: entry.id, entry }],
});

it.each(['path_payment_strict_send', 'path_payment_strict_receive'])(
  'projects exact actual legs for %s without amount limits',
  type => {
    const entry = mapHistoryEntry(
      { ...record, type, sourceMax: '999', destinationMin: '888' } as HistoryOperationRecord,
      sender,
    );
    expect(entry).toMatchObject({
      kind: 'path-payment',
      successful: true,
      direction: 'outgoing',
      sourceAmount: '922337203685.4775807',
      destinationAmount: '0.0000001',
    });
    expect(entry).not.toHaveProperty('sourceMax');
    expect(Object.isFrozen(entry)).toBe(true);
  },
);
it.each([
  [sender, 'outgoing'],
  [recipient, 'incoming'],
  [issuer, 'neutral'],
] as const)('derives %s direction from endpoints only', (address, direction) => {
  expect(mapHistoryEntry(record, address)).toMatchObject({ direction });
});
it('distinguishes self swaps by full asset identity including equal codes and issued XLM', () => {
  for (const asset of [
    { kind: 'credit', code: 'XLM', issuer } as const,
    { kind: 'credit', code: 'USD', issuer: recipient } as const,
  ]) {
    const entry = mapHistoryEntry({ ...record, to: sender, asset }, sender);
    expect(entry.kind).toBe('path-payment');
    if (entry.kind !== 'path-payment') throw new Error('expected-path');
    expect(isPathSwap(entry)).toBe(true);
  }
  const same = mapHistoryEntry({ ...record, to: sender, asset: record.sourceAsset }, sender);
  if (same.kind !== 'path-payment') throw new Error('expected-path');
  expect(isPathSwap(same)).toBe(false);
  const external = mapHistoryEntry(record, sender);
  if (external.kind !== 'path-payment') throw new Error('expected-path');
  expect(isPathSwap(external)).toBe(false);
  const equalCode = mapHistoryEntry(
    { ...record, to: sender, sourceAsset: { kind: 'credit', code: 'USD', issuer: recipient } },
    sender,
  );
  if (equalCode.kind !== 'path-payment') throw new Error('expected-path');
  expect(isPathSwap(equalCode)).toBe(true);
});
it('preserves both explicit muxed identities and Classic bases', () => {
  expect(
    mapHistoryEntry({ ...record, fromMuxed: 'M' + 'A'.repeat(68), toMuxed: 'M' + 'B'.repeat(68) }, sender),
  ).toMatchObject({
    participants: [
      { role: 'sender', identity: 'M' + 'A'.repeat(68), baseAccount: sender },
      { role: 'recipient', identity: 'M' + 'B'.repeat(68), baseAccount: recipient },
    ],
  });
});
it.each([
  { successful: undefined },
  { successful: 'true' },
  { from: undefined },
  { to: undefined },
  { from: recipient },
  { sourceAmount: undefined },
  { sourceAmount: '0' },
  { amount: '-1' },
  { amount: '1e2' },
  { amount: '0.00000001' },
  { amount: '922337203685.4775808' },
  { amount: 'NaN' },
  { amount: 1 },
  { sourceAsset: { kind: 'unsupported' } },
  { asset: { kind: 'credit', code: '', issuer } },
  { toMuxed: '' },
  { fromMuxed: 123 },
  { to: 'garbage' },
])('retains malformed or unsettled operation as explicit non-monetary fallback %p', override => {
  expect(mapHistoryEntry({ ...record, ...override } as HistoryOperationRecord, sender)).toMatchObject({
    kind: 'unsupported',
    reason: 'operation-shape',
    id: record.id,
  });
});
it('normalizes cache payload, strips extra fields and preserves legacy unsupported paths', () => {
  const entry = { ...mapHistoryEntry(record, sender), injected: 'drop' };
  const normalized = normalizeHistoryCacheSnapshot(snapshot(entry), { networkId: 'test', accountAddress: sender });
  expect(normalized.entries[0]).not.toHaveProperty('injected');
  expect(normalized.entries[0]).toEqual(mapHistoryEntry(record, sender));
  expect(Object.isFrozen(normalized.entries[0])).toBe(true);
  const legacy = { ...entry, kind: 'unsupported', reason: 'operation-type' } as const;
  expect(normalizeHistoryCacheSnapshot(snapshot(legacy)).entries[0]).toMatchObject({ kind: 'unsupported' });
  expect(
    normalizeHistoryCacheSnapshot(snapshot(mapHistoryEntry({ ...record, successful: false }, sender)), { networkId: 'test', accountAddress: sender }).entries[0],
  ).toMatchObject({ kind: 'failed', successful: false });
});
it.each([
  { successful: false },
  { direction: 'incoming' },
  { counterparty: sender },
  { sourceAmount: '0' },
  { operationType: 'payment' },
  { sourceAccount: recipient },
  { sourceAsset: { kind: 'native', code: 'USD' } },
  {
    participants: [
      { role: 'recipient', identity: sender },
      { role: 'sender', identity: recipient },
    ],
  },
])('rejects inconsistent path cache fields %p', override => {
  const entry = { ...mapHistoryEntry(record, sender), ...override };
  expect(() =>
    normalizeHistoryCacheSnapshot(snapshot(entry as ReturnType<typeof mapHistoryEntry>), {
      networkId: 'test',
      accountAddress: sender,
    }),
  ).toThrow();
});
it('rejects a direction valid in another partition and mismatched list/detail', () => {
  expect(() => normalizeHistoryCacheSnapshot(snapshot(), { networkId: 'test', accountAddress: recipient })).toThrow();
  expect(() =>
    normalizeHistoryCacheSnapshot({
      ...snapshot(),
      details: [{ operationId: record.id, entry: mapHistoryEntry({ ...record, amount: '2' }, sender) }],
    }),
  ).toThrow('history-cache-detail-mismatch');
});
it('rejects foreign path detail, including an issuer-only association', async () => {
  const account: AccountRecord = {
    id: 'one',
    address: issuer,
    identityKind: 'classic',
    networkId: 'test',
    label: '',
    sortOrder: 0,
    hidden: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const dependencies = {
    networkId: 'test',
    gateway: {
      loadOperation: jest.fn().mockResolvedValue({ status: 'found', record }),
      loadAccountOperations: jest.fn(),
    },
  };
  await expect(loadHistoryOperationDetails(dependencies, account, record.id)).resolves.toEqual({
    status: 'not-associated',
  });
});

it('preserves positive decimal strings with leading zeroes without widening the i64 range', () => {
  expect(mapHistoryEntry({ ...record, sourceAmount: '0000000000000000000001.0000000' }, sender)).toMatchObject({
    kind: 'path-payment',
    sourceAmount: '0000000000000000000001.0000000',
  });
});
