import type { HistoryEntry } from '@capabilities/history/types';

import { mergeActivityEntries } from './activityList';

export type ActivityReadyState = Readonly<{
  entries: readonly HistoryEntry[];
  nextCursor?: string;
  acceptedCursors: readonly string[];
  refreshing: boolean;
  refreshFailed: boolean;
  loadingMore: boolean;
  loadMoreFailed: boolean;
}>;

type ActiveHistoryPage = Readonly<{
  entries: readonly HistoryEntry[];
  nextCursor?: string;
}>;

export function createActivityReadyState(page: ActiveHistoryPage): ActivityReadyState {
  return {
    entries: page.entries,
    ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }),
    acceptedCursors: page.nextCursor === undefined ? [] : [page.nextCursor],
    refreshing: false,
    refreshFailed: false,
    loadingMore: false,
    loadMoreFailed: false,
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

export function failActivityRefresh(state: ActivityReadyState): ActivityReadyState {
  return {
    ...state,
    refreshing: false,
    refreshFailed: true,
  };
}

export function startActivityLoadMore(state: ActivityReadyState): ActivityReadyState {
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
  };
}
