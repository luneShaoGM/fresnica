import type { HistoryCacheSnapshot } from '@capabilities/history/HistoryCacheRepository';
import type { HistoryEntry } from '@capabilities/history/types';

import { mergeActivityEntries } from './activityList';

export type ActivityReadySource = 'cache' | 'online';

export type ActivityReadyState = Readonly<{
  entries: readonly HistoryEntry[];
  nextCursor?: string;
  acceptedCursors: readonly string[];
  refreshing: boolean;
  refreshFailed: boolean;
  loadingMore: boolean;
  loadMoreFailed: boolean;
  source: ActivityReadySource;
  stale: boolean;
  lastSuccessfulHorizonUpdateAt?: Date;
}>;

type ActiveHistoryPage = Readonly<{
  entries: readonly HistoryEntry[];
  nextCursor?: string;
}>;

export function createActivityReadyState(page: ActiveHistoryPage, updatedAt?: Date): ActivityReadyState {
  return {
    entries: page.entries,
    ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }),
    acceptedCursors: page.nextCursor === undefined ? [] : [page.nextCursor],
    refreshing: false,
    refreshFailed: false,
    loadingMore: false,
    loadMoreFailed: false,
    source: 'online',
    stale: false,
    ...(updatedAt === undefined ? {} : { lastSuccessfulHorizonUpdateAt: new Date(updatedAt) }),
  };
}

export function createCachedActivityReadyState(snapshot: HistoryCacheSnapshot): ActivityReadyState {
  return {
    entries: snapshot.entries,
    acceptedCursors: [],
    refreshing: true,
    refreshFailed: false,
    loadingMore: false,
    loadMoreFailed: false,
    source: 'cache',
    stale: true,
    lastSuccessfulHorizonUpdateAt: new Date(snapshot.lastSuccessfulHorizonUpdateAt),
  };
}

export function startActivityRefresh(state: ActivityReadyState): ActivityReadyState {
  return {
    ...state,
    refreshing: true,
    refreshFailed: false,
    loadingMore: false,
    loadMoreFailed: false,
  };
}

export function markActivityStaleForRevalidation(state: ActivityReadyState): ActivityReadyState {
  return {
    ...startActivityRefresh(state),
    stale: true,
  };
}

export function failActivityRefresh(state: ActivityReadyState): ActivityReadyState {
  return {
    ...state,
    refreshing: false,
    refreshFailed: true,
  };
}

export function startActivityLoadMore(state: ActivityReadyState): ActivityReadyState {
  if (state.source !== 'online' || state.stale) {
    return state;
  }
  return {
    ...state,
    loadingMore: true,
    loadMoreFailed: false,
  };
}

export function failActivityLoadMore(state: ActivityReadyState): ActivityReadyState {
  return {
    ...state,
    loadingMore: false,
    loadMoreFailed: true,
  };
}

export function appendActivityHistoryPage(
  state: ActivityReadyState,
  requestCursor: string,
  page: ActiveHistoryPage,
  updatedAt?: Date,
): ActivityReadyState {
  if (
    page.nextCursor !== undefined &&
    (page.nextCursor === requestCursor || state.acceptedCursors.includes(page.nextCursor))
  ) {
    return failActivityLoadMore(state);
  }

  return {
    entries: mergeActivityEntries(state.entries, page.entries),
    ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }),
    acceptedCursors:
      page.nextCursor === undefined ? state.acceptedCursors : [...state.acceptedCursors, page.nextCursor],
    refreshing: false,
    refreshFailed: false,
    loadingMore: false,
    loadMoreFailed: false,
    source: 'online',
    stale: false,
    ...(updatedAt === undefined
      ? state.lastSuccessfulHorizonUpdateAt === undefined
        ? {}
        : { lastSuccessfulHorizonUpdateAt: state.lastSuccessfulHorizonUpdateAt }
      : { lastSuccessfulHorizonUpdateAt: new Date(updatedAt) }),
  };
}
