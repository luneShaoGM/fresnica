import { historyJoinedMemo } from '../historyJoinedMemo';
import { mapHistoryOperationRecord } from '../StellarSdkGateway';
import type { HorizonOperationLike } from '../types';
import { mapHistoryEntry } from '../../../capabilities/history/loadHistoryPage';
import { normalizeHistoryCacheSnapshot } from '../../../capabilities/history/HistoryCacheRepository';
const source = 'G' + 'A'.repeat(55);
const recipient = 'G' + 'B'.repeat(55);
const wire = {
  id: '1',
  paging_token: '1',
  type: 'payment',
  type_i: 1,
  created_at: '2026-11-10T00:00:00Z',
  transaction_hash: 'tx',
  transaction_successful: true,
  source_account: source,
  from: source,
  to: recipient,
  amount: '1',
  asset_type: 'native',
} as HorizonOperationLike;
it('accepts hash-bound joined typed memo and preserves it through cache normalization', () => {
  const input = { ...wire, transaction_attr: { hash: 'tx', memo_type: 'id', memo: '0007' } };
  const memo = { recipient, memo: { type: 'id', value: '7' } };
  expect(historyJoinedMemo(input)).toEqual(memo);
  const entry = mapHistoryEntry(mapHistoryOperationRecord(input), source);
  const snapshot = {
    schemaVersion: 1 as const,
    lastSuccessfulHorizonUpdateAt: new Date(0),
    entries: [entry],
    details: [],
  };
  const normalized = normalizeHistoryCacheSnapshot(snapshot, { networkId: 'test', accountAddress: source });
  expect(normalized.entries[0].recipientMemo).toEqual(memo);
  expect(() =>
    normalizeHistoryCacheSnapshot(
      { ...snapshot, entries: [{ ...entry, recipientMemo: { recipient: source, memo: { type: 'id', value: '7' } } }] },
      { networkId: 'test', accountAddress: source },
    ),
  ).toThrow('recipient-mismatch');
});
it.each(['hash', 'return'] as const)('converts canonical Horizon %s bytes to the shared hex identity', type => {
  expect(
    historyJoinedMemo({
      ...wire,
      transaction_attr: { hash: 'tx', memo_type: type, memo: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' },
    }),
  ).toEqual({ recipient, memo: { type, value: '00'.repeat(32) } });
});
it.each([
  { hash: 'other', memo_type: 'text', memo: 'a' },
  { memo_type: 'text', memo: 'a' },
  { hash: 'tx', memo_type: 'id', memo: '18446744073709551616' },
  { hash: 'tx', memo_type: 'hash', memo: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB=' },
  { hash: 'tx', memo_type: 'text', memo: 'a'.repeat(29) },
  { hash: 'tx', memo_type: 'none', memo: '' },
])('ignores unbound or malformed joined context %#', transaction_attr => {
  expect(historyJoinedMemo({ ...wire, transaction_attr })).toBeUndefined();
});

it('fetches matching joined context for list and detail so viewed details remain cacheable offline', async () => {
  const { createHorizonPublicReadGateway } = jest.requireActual(
    '../HorizonPublicReadGateway',
  ) as typeof import('../HorizonPublicReadGateway');
  const { cacheHistoryReadyDetailBestEffort } = jest.requireActual(
    '../../../capabilities/history/HistoryCacheHydration',
  ) as typeof import('../../../capabilities/history/HistoryCacheHydration');
  const joined = { ...wire, transaction_attr: { hash: 'tx', memo_type: 'id', memo: '7' } };
  const http = jest.fn(
    async (url: string) =>
      ({
        ok: true,
        status: 200,
        json: async () => (url.includes('/accounts/') ? { _embedded: { records: [joined] } } : joined),
      }) as Response,
  );
  const reads = createHorizonPublicReadGateway(http as typeof fetch);
  const signal = new AbortController().signal;
  const list = await reads.loadAccountOperations('https://node.test', { address: source, limit: 15 }, signal);
  const detail = await reads.loadOperation('https://node.test', { accountAddress: source, operationId: '1' }, signal);
  expect(http.mock.calls[1][0]).toContain('/operations/1?join=transactions');
  if (list.status !== 'active' || detail.status !== 'found') throw new Error('fixture');
  const entry = mapHistoryEntry(list.records[0], source);
  const detailEntry = mapHistoryEntry(detail.record, source);
  const account = {
    id: 'a',
    address: source,
    networkId: 'test',
    identityKind: 'classic' as const,
    label: 'A',
    hidden: false,
    sortOrder: 0,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
  const replaceSnapshot = jest.fn();
  const deps = {
    networkId: 'test',
    now: () => new Date(0),
    gateway: { loadAccountOperations: jest.fn(), loadOperation: jest.fn() },
    cache: {
      getSnapshot: () => ({
        schemaVersion: 1 as const,
        lastSuccessfulHorizonUpdateAt: new Date(0),
        entries: [entry],
        details: [],
      }),
      replaceSnapshot,
      clearPartition: jest.fn(),
    },
  };
  expect(cacheHistoryReadyDetailBestEffort(deps, account, detailEntry)).toBe(true);
  expect(replaceSnapshot.mock.calls[0][1].details[0].entry.recipientMemo).toEqual(entry.recipientMemo);
});
