import React from 'react';
import { Pressable } from 'react-native';
import type { AccountRecord } from '@capabilities/account/types';
import type { HistoryProductDependencies } from '@capabilities/history/HistoryCacheHydration';
import { loadHistoryPage } from '@capabilities/history/loadHistoryPage';
import { loadHistoryOperationDetails } from '@capabilities/history/loadHistoryOperationDetails';
import type { HistoryPage, HistoryEntry } from '@capabilities/history/types';
import { ActivityScreen, ActivityContent } from '../ActivityScreen';
import { OperationDetailsScreen } from '../OperationDetailsScreen';
jest.mock('@capabilities/history/loadHistoryPage', () => ({ loadHistoryPage: jest.fn() }));
jest.mock('@capabilities/history/loadHistoryOperationDetails', () => ({ loadHistoryOperationDetails: jest.fn() }));
type Slot = { value?: unknown; deps?: readonly unknown[]; cleanup?: () => void };
let mockSlots: Slot[] = [];
let mockCursor = 0;
let mockEffects: Array<() => void> = [];
const mockSameDeps = (a: readonly unknown[] | undefined, b: readonly unknown[]) =>
  a !== undefined && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useMemo: (factory: () => unknown) => factory(),
  useState: (initial: unknown) => {
    const index = mockCursor++;
    if (!mockSlots[index]) mockSlots[index] = { value: initial };
    return [
      mockSlots[index].value,
      (next: unknown) => {
        mockSlots[index].value = typeof next === 'function' ? next(mockSlots[index].value) : next;
      },
    ];
  },
  useRef: (value: unknown) => {
    const index = mockCursor++;
    if (!mockSlots[index]) mockSlots[index] = { value: { current: value } };
    return mockSlots[index].value;
  },
  useCallback: (callback: unknown, deps: readonly unknown[]) => {
    const index = mockCursor++;
    if (!mockSameDeps(mockSlots[index]?.deps, deps)) mockSlots[index] = { value: callback, deps };
    return mockSlots[index].value;
  },
  useEffect: (effect: () => (() => void) | undefined, deps: readonly unknown[]) => {
    const index = mockCursor++;
    if (mockSameDeps(mockSlots[index]?.deps, deps)) return;
    const previous = mockSlots[index]?.cleanup;
    mockSlots[index] = { deps };
    mockEffects.push(() => {
      previous?.();
      mockSlots[index].cleanup = effect();
    });
  },
}));

jest.mock('@fresnica/ui-native', () => ({ StateView: () => null, Button: () => null }));

jest.mock('@ui/theme', () => {
  const actual = jest.requireActual('@ui/theme') as typeof import('@ui/theme');
  return {
    ...actual,
    useAppTheme: () => actual.defaultTheme,
    useThemedStyles: (factory: (theme: typeof actual.defaultTheme) => unknown) => factory(actual.defaultTheme),
  };
});
jest.mock('../../../locale', () => {
  const localization = jest.requireActual('../../../locale/localization').createLocalization('en');
  return { useLocalization: () => localization };
});

const account: AccountRecord = {
  id: 'a',
  address: 'GA',
  networkId: 'stellar-testnet',
  identityKind: 'classic',
  label: 'A',
  sortOrder: 0,
  hidden: false,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};
const dependencies: HistoryProductDependencies = {
  networkId: account.networkId,
  now: () => new Date(0),
  cache: { getSnapshot: jest.fn(), replaceSnapshot: jest.fn(), clearPartition: jest.fn() },
  gateway: { loadAccountOperations: jest.fn(), loadOperation: jest.fn() },
};
const pageLoad = jest.mocked(loadHistoryPage);
const detailLoad = jest.mocked(loadHistoryOperationDetails);
const entry = (id: string): HistoryEntry => ({
  id,
  pagingToken: id,
  operationType: 'future',
  occurredAt: '2026-10-30T00:00:00Z',
  transactionHash: 'tx',
  sourceAccount: 'GA',
  kind: 'unsupported',
  reason: 'operation-type',
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => {
    resolve = done;
  });
  return { promise, resolve };
}
async function settle() {
  for (let i = 0; i < 15; i++) await Promise.resolve();
}
function effects() {
  const pending = mockEffects;
  mockEffects = [];
  pending.forEach(effect => effect());
}
function activity(revision = 0) {
  mockCursor = 0;
  return ActivityScreen({
    account,
    dependencies,
    active: true,
    invalidationRevision: revision,
    onOpenOperation: jest.fn(),
    onManualRefresh: async () => undefined,
  });
}
function detail(revision = 0, operationId = '1') {
  mockCursor = 0;
  return OperationDetailsScreen({
    account,
    operationId,
    dependencies,
    active: true,
    invalidationRevision: revision,
    onBack: jest.fn(),
    openExternalUrl: async () => undefined,
    projectExplorerUrl: () => undefined,
  });
}
function children(
  node: React.ReactNode,
): React.ReactElement<{ children?: React.ReactNode; onLoadMore?: () => void }>[] {
  if (!React.isValidElement<{ children?: React.ReactNode; onLoadMore?: () => void }>(node)) return [];
  return [node, ...React.Children.toArray(node.props.children).flatMap(children)];
}
beforeEach(() => {
  mockSlots = [];
  mockCursor = 0;
  mockEffects = [];
  jest.clearAllMocks();
  pageLoad.mockReset();
  detailLoad.mockReset();
});
it('silently revalidates a paged activity list, blocks concurrent pagination, then publishes a changed head', async () => {
  const head: HistoryPage = { status: 'active', entries: [entry('2')], nextCursor: 'head' };
  pageLoad.mockResolvedValueOnce(head);
  activity();
  effects();
  await settle();
  pageLoad.mockResolvedValueOnce({ status: 'active', entries: [entry('1')], nextCursor: 'tail' });
  children(activity())
    .find(node => node.type === ActivityContent)
    ?.props.onLoadMore?.();
  await settle();
  const ready = mockSlots[0].value;
  expect(ready).toMatchObject({ entries: [entry('2'), entry('1')], nextCursor: 'tail' });
  const pending = deferred<HistoryPage>();
  pageLoad.mockReturnValueOnce(pending.promise);
  activity(1);
  effects();
  await settle();
  expect(mockSlots[0].value).toBe(ready);
  children(activity(1))
    .find(node => node.type === ActivityContent)
    ?.props.onLoadMore?.();
  expect(pageLoad).toHaveBeenCalledTimes(3);
  pending.resolve(head);
  await settle();
  expect(mockSlots[0].value).toBe(ready);
  pageLoad.mockResolvedValueOnce({ status: 'active', entries: [entry('3')], nextCursor: 'new' });
  activity(2);
  effects();
  await settle();
  expect(mockSlots[0].value).toMatchObject({ entries: [entry('3')], nextCursor: 'new', refreshing: false });
  pageLoad.mockRejectedValueOnce(new Error('offline'));
  activity(3);
  effects();
  await settle();
  expect(mockSlots[0].value).toMatchObject({ entries: [entry('3')], stale: true, refreshFailed: true });
});
it('keeps inactive activity mounted during polling and updates it on activation', async () => {
  pageLoad.mockResolvedValueOnce({ status: 'inactive' });
  activity();
  effects();
  await settle();
  const ready = mockSlots[0].value;
  const pending = deferred<HistoryPage>();
  pageLoad.mockReturnValueOnce(pending.promise);
  activity(1);
  effects();
  await settle();
  expect(mockSlots[0].value).toBe(ready);
  pending.resolve({ status: 'inactive' });
  await settle();
  expect(mockSlots[0].value).toBe(ready);
  pageLoad.mockResolvedValueOnce({ status: 'active', entries: [] });
  activity(2);
  effects();
  await settle();
  expect(mockSlots[0].value).toMatchObject({ kind: 'ready', entries: [] });
});
it('publishes an empty unpaginated head instead of preserving obsolete rows', async () => {
  pageLoad.mockResolvedValueOnce({ status: 'active', entries: [entry('1')] });
  activity();
  effects();
  await settle();
  pageLoad.mockResolvedValueOnce({ status: 'active', entries: [] });
  activity(1);
  effects();
  await settle();
  expect(mockSlots[0].value).toMatchObject({ entries: [] });
});
it('keeps live operation details steady through revalidation and rejects a previous operation response', async () => {
  const result = { status: 'ready' as const, entry: entry('1') };
  detailLoad.mockResolvedValueOnce(result);
  detail();
  effects();
  await settle();
  const ready = mockSlots[0].value;
  const pending = deferred<typeof result>();
  detailLoad.mockReturnValueOnce(pending.promise);
  detail(1);
  effects();
  await settle();
  expect(mockSlots[0].value).toBe(ready);
  pending.resolve(result);
  await settle();
  expect(mockSlots[0].value).toBe(ready);
  const old = deferred<typeof result>();
  detailLoad.mockReturnValueOnce(old.promise);
  detail(2);
  effects();
  await settle();
  detailLoad.mockResolvedValueOnce({ status: 'not-found' });
  detail(2, '2');
  effects();
  await settle();
  old.resolve(result);
  await settle();
  expect(mockSlots[0].value).toMatchObject({ result: { status: 'not-found' } });
});
it('retains details with honest failure state until a retry succeeds', async () => {
  const result = { status: 'ready' as const, entry: entry('1') };
  detailLoad.mockResolvedValueOnce(result);
  detail();
  effects();
  await settle();
  detailLoad.mockRejectedValueOnce(new Error('offline'));
  detail(1);
  effects();
  await settle();
  expect(mockSlots[0].value).toMatchObject({ result, stale: true, refreshFailed: true });
  const failed = mockSlots[0].value;
  detailLoad.mockResolvedValueOnce(result);
  detail(2);
  effects();
  expect(mockSlots[0].value).toBe(failed);
  await settle();
  expect(mockSlots[0].value).toMatchObject({ result, stale: false, refreshFailed: false });
});

it('retires an interrupted pagination result while preserving rows through the new head check', async () => {
  const head: HistoryPage = { status: 'active', entries: [entry('2')], nextCursor: 'head' };
  pageLoad.mockResolvedValueOnce(head);
  activity();
  effects();
  await settle();
  const old = deferred<HistoryPage>();
  pageLoad.mockReturnValueOnce(old.promise);
  children(activity())
    .find(node => node.type === ActivityContent)
    ?.props.onLoadMore?.();
  await settle();
  expect(mockSlots[0].value).toMatchObject({ loadingMore: true });
  const pending = deferred<HistoryPage>();
  pageLoad.mockReturnValueOnce(pending.promise);
  activity(1);
  effects();
  await settle();
  expect(mockSlots[0].value).toMatchObject({ entries: [entry('2')], loadingMore: false, refreshing: false });
  old.resolve({ status: 'active', entries: [entry('1')], nextCursor: 'tail' });
  await settle();
  expect(mockSlots[0].value).toMatchObject({ entries: [entry('2')], nextCursor: 'head' });
  pending.resolve(head);
  await settle();
  pageLoad.mockResolvedValueOnce({ status: 'active', entries: [entry('1')] });
  children(activity(1))
    .find(node => node.type === ActivityContent)
    ?.props.onLoadMore?.();
  await settle();
  expect(mockSlots[0].value).toMatchObject({ entries: [entry('2'), entry('1')], loadingMore: false });
});
it('keeps a no-cache operation error visible during automatic retries', async () => {
  detailLoad.mockRejectedValueOnce(new Error('offline'));
  detail();
  effects();
  await settle();
  const failed = mockSlots[0].value;
  const pending = deferred<{ status: 'not-found' }>();
  detailLoad.mockReturnValueOnce(pending.promise);
  detail(1);
  effects();
  await settle();
  expect(mockSlots[0].value).toBe(failed);
  pending.resolve({ status: 'not-found' });
  await settle();
  expect(mockSlots[0].value).toMatchObject({ kind: 'loaded', result: { status: 'not-found' } });
});

it('clears a superseded manual spinner when automatic revalidation takes over', async () => {
  const head: HistoryPage = { status: 'active', entries: [entry('2')], nextCursor: 'head' };
  pageLoad.mockResolvedValueOnce(head);
  activity();
  effects();
  await settle();
  const old = deferred<HistoryPage>();
  pageLoad.mockReturnValueOnce(old.promise);
  const root = activity();
  const refresh = children(root).find(node => node.type === Pressable);
  (refresh?.props as { onPress?: () => void }).onPress?.();
  await settle();
  expect(mockSlots[0].value).toMatchObject({ refreshing: true });
  pageLoad.mockResolvedValueOnce(head);
  activity(1);
  effects();
  await settle();
  expect(mockSlots[0].value).toMatchObject({ refreshing: false, entries: [entry('2')] });
  old.resolve({ status: 'inactive' });
  await settle();
  expect(mockSlots[0].value).toMatchObject({ kind: 'ready', refreshing: false });
});
