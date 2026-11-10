import { retainReferenceEvidence } from './claimableEffects';
import type { AccountRecord } from '../account/types';
import { loadHistoryPage, type HistoryDependencies } from './loadHistoryPage';
import type { HistoryEntry, HistoryPage } from './types';

export function mergeHistoryEntries(fresh: readonly HistoryEntry[], older: readonly HistoryEntry[]): HistoryEntry[] {
  const byId = new Map(older.map(entry => [entry.id, entry]));
  fresh.forEach(entry => byId.set(entry.id, retainReferenceEvidence(entry, byId.get(entry.id))));
  return [...byId.values()].sort((a, b) => {
    if (/^\d+$/.test(a.pagingToken) && /^\d+$/.test(b.pagingToken)) {
      const left = BigInt(a.pagingToken);
      const right = BigInt(b.pagingToken);
      return left === right ? 0 : left > right ? -1 : 1;
    }
    return Date.parse(b.occurredAt) - Date.parse(a.occurredAt);
  });
}
export type HistoryWindow = Readonly<{
  page: HistoryPage;
  headEntries: readonly HistoryEntry[];
  headCursor?: string;
  freshCount: number;
}>;

// Cache entries are display-only until a current head read overlaps their anchor.
export async function loadHistoryHead(
  deps: HistoryDependencies,
  account: AccountRecord,
  cached: readonly HistoryEntry[],
  current: () => boolean,
): Promise<HistoryWindow> {
  let page = await loadHistoryPage(deps, account);
  if (!current()) throw new Error('history-read-superseded');
  if (page.status !== 'active') return { page, headEntries: [], freshCount: 0 };
  const headEntries = page.entries;
  const headCursor = page.nextCursor;
  const anchor = cached[0]?.id;
  let fresh = [...page.entries];
  const cursors = new Set<string>();
  for (let count = 1; anchor && !fresh.some(entry => entry.id === anchor) && page.nextCursor && count < 120; count++) {
    const cursor = page.nextCursor;
    if (cursors.has(cursor)) throw new Error('history-repeated-cursor');
    cursors.add(cursor);
    const next = await loadHistoryPage(deps, account, { cursor });
    if (!current()) throw new Error('history-read-superseded');
    if (next.status !== 'active') throw new Error('history-page-partition-changed');
    if (next.nextCursor === cursor) throw new Error('history-repeated-cursor');
    fresh = mergeHistoryEntries(next.entries, fresh);
    page = next;
  }
  const overlap = anchor && fresh.some(entry => entry.id === anchor);
  return {
    page: { ...page, entries: mergeHistoryEntries(fresh, overlap ? cached : []) },
    headEntries,
    headCursor,
    freshCount: fresh.length,
  };
}

// Fill only with current-session remote cursors; never resume a persisted cursor.
export async function backfillHistory(
  deps: HistoryDependencies,
  account: AccountRecord,
  window: HistoryWindow,
  current: () => boolean,
  onPage: (cursor: string, page: Extract<HistoryPage, { status: 'active' }>) => void,
): Promise<void> {
  let cursor = window.page.status === 'active' ? window.page.nextCursor : undefined;
  let count = window.freshCount;
  const cursors = new Set<string>();
  for (let pages = 0; cursor && count < 500 && pages < 120 && current(); pages++) {
    if (cursors.has(cursor)) throw new Error('history-repeated-cursor');
    cursors.add(cursor);
    const page = await loadHistoryPage(deps, account, { cursor });
    if (!current()) return;
    if (page.status !== 'active' || page.nextCursor === cursor || (page.nextCursor && cursors.has(page.nextCursor)))
      throw new Error('history-repeated-cursor');
    onPage(cursor, page);
    count += page.entries.length;
    cursor = page.nextCursor;
  }
}
