import { effectsRecord, effectsSource } from './claimableEffects.fixtures';
import { loadHistoryHead, backfillHistory, mergeHistoryEntries } from '../loadHistoryWindow';
import { mapHistoryEntry, type HistoryDependencies } from '../loadHistoryPage';
import type { AccountRecord } from '../../account/types';
const address = 'G' + 'A'.repeat(55);
const account: AccountRecord = {
  id: 'a',
  address,
  networkId: 'test',
  identityKind: 'classic',
  label: 'A',
  hidden: false,
  sortOrder: 0,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};
const record = (id: number | string) => ({
  id: String(id),
  pagingToken: String(id),
  type: 'future',
  occurredAt: '2026-11-10T00:00:00Z',
  transactionHash: 'tx',
  sourceAccount: address,
  successful: true,
});
const entry = (id: number | string) => mapHistoryEntry(record(id), address);
const page = (ids: number[], nextCursor?: string) => ({
  status: 'active' as const,
  address,
  records: ids.map(record),
  ...(nextCursor ? { nextCursor } : {}),
});
function setup() {
  const loadAccountOperations = jest.fn();
  const deps: HistoryDependencies = { networkId: 'test', gateway: { loadAccountOperations, loadOperation: jest.fn() } };
  return { deps, loadAccountOperations };
}
it('reads pages15 until the cache anchor, preserving exact token order and fresh replacements', async () => {
  const { deps, loadAccountOperations: load } = setup();
  load
    .mockResolvedValueOnce(page([30, 29], 'a'))
    .mockResolvedValueOnce(page([28, 27], 'b'))
    .mockResolvedValueOnce(page([26, 25], 'c'));
  const result = await loadHistoryHead(deps, account, [entry(26), entry(24), entry(23)], () => true);
  expect(load.mock.calls[0][0]).toEqual({ address, limit: 15 });
  expect(result.page).toMatchObject({ entries: [30, 29, 28, 27, 26, 25, 24, 23].map(entry), nextCursor: 'c' });
  expect(result.headCursor).toBe('a');
  expect(result.freshCount).toBe(6);
  expect(mergeHistoryEntries([entry('9007199254740993')], [entry('9007199254740992')]).map(item => item.id)).toEqual([
    '9007199254740993',
    '9007199254740992',
  ]);
});
it('does not append an unconnected cache tail when remote exhausts', async () => {
  const { deps, loadAccountOperations: load } = setup();
  load.mockResolvedValueOnce(page([4, 3]));
  expect((await loadHistoryHead(deps, account, [entry(2)], () => true)).page).toMatchObject({
    entries: [entry(4), entry(3)],
  });
});
it('preserves errors as retryable and fences a changed account before publishing', async () => {
  const { deps, loadAccountOperations: load } = setup();
  load.mockResolvedValueOnce(page([5], 'a')).mockRejectedValueOnce(new Error('offline'));
  await expect(loadHistoryHead(deps, account, [entry(1)], () => true)).rejects.toThrow('offline');
  load.mockResolvedValueOnce(page([5]));
  await expect(loadHistoryHead(deps, account, [], () => false)).rejects.toThrow('superseded');
});
it('bounds head catch-up at120 pages and refuses cycles', async () => {
  const { deps, loadAccountOperations: load } = setup();
  let next = 1000;
  load.mockImplementation(async () => {
    const id = next--;
    return page([id], String(id));
  });
  const result = await loadHistoryHead(deps, account, [entry(1)], () => true);
  expect(load).toHaveBeenCalledTimes(120);
  expect(result.page.status === 'active' && result.page.entries.some(item => item.id === '1')).toBe(false);
  load.mockReset().mockResolvedValue(page([5], 'a'));
  await expect(loadHistoryHead(deps, account, [entry(1)], () => true)).rejects.toThrow('repeated-cursor');
});
it('fills in the background toward500 using online cursors only, and stops at a partition change', async () => {
  const { deps, loadAccountOperations: load } = setup();
  let next = 1000;
  load.mockImplementation(async () => {
    const ids = Array.from({ length: 15 }, () => next--);
    return page(ids, String(next));
  });
  const window = await loadHistoryHead(deps, account, [], () => true);
  const onPage = jest.fn();
  await backfillHistory(deps, account, window, () => true, onPage);
  expect(load).toHaveBeenCalledTimes(34);
  expect(onPage).toHaveBeenCalledTimes(33);
  expect(load.mock.calls[1][0].cursor).toBe(window.page.status === 'active' ? window.page.nextCursor : undefined);
  const count = load.mock.calls.length;
  await backfillHistory(deps, account, window, () => false, onPage);
  expect(load).toHaveBeenCalledTimes(count);
});
it('never publishes a background page with a repeated cursor', async () => {
  const { deps, loadAccountOperations: load } = setup();
  load.mockResolvedValueOnce(page([5], 'a')).mockResolvedValueOnce(page([4], 'a'));
  const window = await loadHistoryHead(deps, account, [], () => true);
  const onPage = jest.fn();
  await expect(backfillHistory(deps, account, window, () => true, onPage)).rejects.toThrow('repeated-cursor');
  expect(onPage).not.toHaveBeenCalled();
});

it('retains immutable same-reference quantity evidence when an optional effect read is temporarily absent', () => {
  const known = mapHistoryEntry(effectsRecord(), effectsSource);
  const degraded = mapHistoryEntry(effectsRecord('claim_claimable_balance', false), effectsSource);
  expect(known.kind).toBe('claimable-reference');
  expect(mergeHistoryEntries([degraded], [known])[0]).toEqual(known);
  const changed = { ...degraded, transactionHash: 'different' };
  expect(mergeHistoryEntries([changed], [known])[0]).not.toHaveProperty('evidence');
});
