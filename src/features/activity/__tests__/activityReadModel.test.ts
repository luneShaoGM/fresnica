import { HISTORY_CACHE_SCHEMA_VERSION } from '@capabilities/history/HistoryCacheRepository';
import type { HistoryEntry } from '@capabilities/history/types';

import {
  appendActivityHistoryPage,
  createActivityReadyState,
  createCachedActivityReadyState,
  failActivityLoadMore,
  failActivityRefresh,
  markActivityStaleForRevalidation,
  startActivityLoadMore,
  startActivityRefresh,
} from '../activityReadModel';

function unsupported(id: string): HistoryEntry {
  return {
    id,
    pagingToken: id,
    operationType: 'future_operation',
    occurredAt: '2026-08-31T00:00:00Z',
    transactionHash: `tx-${id}`,
    sourceAccount: 'GSOURCE',
    kind: 'unsupported',
    reason: 'operation-type',
  };
}

describe('activityReadModel', () => {
  it('hydrates a cached snapshot as stale without restoring any persisted cursor', () => {
    const updatedAt = new Date('2026-09-20T03:00:00.000Z');
    const cached = createCachedActivityReadyState({
      schemaVersion: HISTORY_CACHE_SCHEMA_VERSION,
      lastSuccessfulHorizonUpdateAt: updatedAt,
      entries: [unsupported('3'), unsupported('2')],
      details: [],
    });

    expect(cached).toMatchObject({
      entries: [unsupported('3'), unsupported('2')],
      acceptedCursors: [],
      refreshing: true,
      refreshFailed: false,
      loadingMore: false,
      loadMoreFailed: false,
      source: 'cache',
      stale: true,
      lastSuccessfulHorizonUpdateAt: updatedAt,
    });
    expect(cached.nextCursor).toBeUndefined();
  });

  it('does not start load-more from a cached or stale page set', () => {
    const cached = createCachedActivityReadyState({
      schemaVersion: HISTORY_CACHE_SCHEMA_VERSION,
      lastSuccessfulHorizonUpdateAt: new Date('2026-09-20T03:00:00.000Z'),
      entries: [unsupported('3')],
      details: [],
    });
    const staleOnline = markActivityStaleForRevalidation(
      createActivityReadyState({
        entries: [unsupported('3')],
        nextCursor: 'opaque-A',
      }),
    );

    expect(startActivityLoadMore(cached)).toBe(cached);
    expect(startActivityLoadMore(staleOnline)).toBe(staleOnline);
  });

  it('marks an online page set stale for invalidation revalidation without changing rows', () => {
    const current = createActivityReadyState(
      {
        entries: [unsupported('3'), unsupported('2')],
        nextCursor: 'opaque-A',
      },
      new Date('2026-09-20T03:00:00.000Z'),
    );

    const stale = markActivityStaleForRevalidation(current);

    expect(stale.entries).toEqual(current.entries);
    expect(stale.nextCursor).toBe('opaque-A');
    expect(stale.refreshing).toBe(true);
    expect(stale.stale).toBe(true);
    expect(stale.loadingMore).toBe(false);
  });

  it('rebuilds the accepted cursor chain from page 1', () => {
    const first = createActivityReadyState({
      entries: [unsupported('3'), unsupported('2')],
      nextCursor: 'cursor-2',
    });
    const refreshed = createActivityReadyState({
      entries: [unsupported('9')],
      nextCursor: 'cursor-9',
    });

    expect(first.acceptedCursors).toEqual(['cursor-2']);
    expect(refreshed).toMatchObject({
      entries: [unsupported('9')],
      nextCursor: 'cursor-9',
      acceptedCursors: ['cursor-9'],
      refreshing: false,
      refreshFailed: false,
    });
  });

  it('appends later pages in gateway order and advances with a new opaque cursor', () => {
    const current = createActivityReadyState({
      entries: [unsupported('3'), unsupported('2')],
      nextCursor: 'opaque-A',
    });

    const next = appendActivityHistoryPage(current, 'opaque-A', {
      entries: [unsupported('2'), unsupported('1')],
      nextCursor: 'opaque-Z',
    });

    expect(next.entries.map(entry => entry.id)).toEqual(['3', '2', '1']);
    expect(next.nextCursor).toBe('opaque-Z');
    expect(next.acceptedCursors).toEqual(['opaque-A', 'opaque-Z']);
    expect(next.loadMoreFailed).toBe(false);
  });

  it('accepts an overlapping page with no new rows when the opaque cursor advances', () => {
    const current = createActivityReadyState({
      entries: [unsupported('3'), unsupported('2')],
      nextCursor: 'opaque-A',
    });

    const next = appendActivityHistoryPage(current, 'opaque-A', {
      entries: [unsupported('2')],
      nextCursor: 'opaque-B',
    });

    expect(next.entries.map(entry => entry.id)).toEqual(['3', '2']);
    expect(next.nextCursor).toBe('opaque-B');
    expect(next.acceptedCursors).toEqual(['opaque-A', 'opaque-B']);
    expect(next.loadMoreFailed).toBe(false);
  });

  it('stops pagination when the accepted later page has no next cursor', () => {
    const current = createActivityReadyState({
      entries: [unsupported('3')],
      nextCursor: 'opaque-A',
    });

    const next = appendActivityHistoryPage(current, 'opaque-A', {
      entries: [unsupported('2')],
    });

    expect(next.entries.map(entry => entry.id)).toEqual(['3', '2']);
    expect(next.nextCursor).toBeUndefined();
    expect(next.acceptedCursors).toEqual(['opaque-A']);
    expect(next.loadingMore).toBe(false);
    expect(next.loadMoreFailed).toBe(false);
  });

  it('fails closed when Horizon returns the same request cursor', () => {
    const current = startActivityLoadMore(
      createActivityReadyState({
        entries: [unsupported('3')],
        nextCursor: 'opaque-A',
      }),
    );

    const next = appendActivityHistoryPage(current, 'opaque-A', {
      entries: [unsupported('2')],
      nextCursor: 'opaque-A',
    });

    expect(next.entries.map(entry => entry.id)).toEqual(['3']);
    expect(next.nextCursor).toBe('opaque-A');
    expect(next.acceptedCursors).toEqual(['opaque-A']);
    expect(next.loadingMore).toBe(false);
    expect(next.loadMoreFailed).toBe(true);
  });

  it('fails closed when a later page loops back to an accepted cursor', () => {
    const first = createActivityReadyState({
      entries: [unsupported('4')],
      nextCursor: 'opaque-A',
    });
    const second = appendActivityHistoryPage(first, 'opaque-A', {
      entries: [unsupported('3')],
      nextCursor: 'opaque-B',
    });

    const loop = appendActivityHistoryPage(startActivityLoadMore(second), 'opaque-B', {
      entries: [unsupported('2')],
      nextCursor: 'opaque-A',
    });

    expect(loop.entries.map(entry => entry.id)).toEqual(['4', '3']);
    expect(loop.nextCursor).toBe('opaque-B');
    expect(loop.acceptedCursors).toEqual(['opaque-A', 'opaque-B']);
    expect(loop.loadMoreFailed).toBe(true);
  });

  it('keeps the failed load-more cursor available for an exact retry', () => {
    const current = createActivityReadyState({
      entries: [unsupported('3')],
      nextCursor: 'opaque-A',
    });
    const failed = failActivityLoadMore(startActivityLoadMore(current));
    const retried = startActivityLoadMore(failed);

    expect(failed.nextCursor).toBe('opaque-A');
    expect(failed.acceptedCursors).toEqual(['opaque-A']);
    expect(failed.loadMoreFailed).toBe(true);
    expect(retried.nextCursor).toBe('opaque-A');
    expect(retried.acceptedCursors).toEqual(['opaque-A']);
    expect(retried.loadingMore).toBe(true);
    expect(retried.loadMoreFailed).toBe(false);
  });

  it('preserves the last successful page set when refresh fails', () => {
    const current = createActivityReadyState({
      entries: [unsupported('3'), unsupported('2')],
      nextCursor: 'opaque-A',
    });
    const failed = failActivityRefresh(startActivityRefresh(current));

    expect(failed.entries).toEqual(current.entries);
    expect(failed.nextCursor).toBe('opaque-A');
    expect(failed.acceptedCursors).toEqual(['opaque-A']);
    expect(failed.refreshing).toBe(false);
    expect(failed.refreshFailed).toBe(true);
  });

  it('refresh supersedes an in-flight load-more without leaving it stuck', () => {
    const loadingMore = startActivityLoadMore(
      createActivityReadyState({
        entries: [unsupported('3')],
        nextCursor: 'opaque-A',
      }),
    );

    const refreshing = startActivityRefresh(loadingMore);
    const failed = failActivityRefresh(refreshing);

    expect(refreshing.refreshing).toBe(true);
    expect(refreshing.loadingMore).toBe(false);
    expect(failed.refreshing).toBe(false);
    expect(failed.loadingMore).toBe(false);
    expect(failed.nextCursor).toBe('opaque-A');
  });
});
