import type { AccountRecord } from '../account/types';
import {
  classifyClaimableSnapshot,
  CLAIMABLE_MAX_ROWS,
  CLAIMABLE_RETRY_MS,
  CLAIMABLE_TTL_MS,
  type ClaimableRecord,
  type ClaimableSnapshot,
} from './records';

export interface ClaimableCacheStore {
  read(networkId: string, accountAddress: string): ClaimableSnapshot | undefined;
  replace(snapshot: ClaimableSnapshot): void;
  userSpam(networkId: string, accountAddress: string, id: string): boolean | undefined;
  setUserSpam(networkId: string, accountAddress: string, id: string, spam: boolean): void;
  clearPartition(networkId: string, accountAddress: string): void;
}

export type ClaimableReadPort = Readonly<{
  page(
    address: string,
    cursor?: string,
  ): Promise<Readonly<{ records: readonly ClaimableRecord[]; nextCursor?: string }>>;
  byId(address: string, id: string): Promise<ClaimableRecord | undefined>;
}>;
export type ClaimableProduct = ReturnType<typeof createClaimableProduct>;
export type ClaimableState = Readonly<{
  snapshot: ClaimableSnapshot;
  stale: boolean;
  refreshFailed: boolean;
}>;

export function createClaimableProduct(
  input: Readonly<{
    networkId: string;
    read: ClaimableReadPort;
    cache: ClaimableCacheStore;
    now: () => number;
    getRevision?: (account: AccountRecord) => string | number;
    isAccountCurrent?: (account: AccountRecord) => boolean;
  }>,
) {
  const pending = new Map<string, Readonly<{ revision: string | number; request: Promise<ClaimableState> }>>();
  const savedRevisions = new Map<string, string | number>();
  const retryAt = new Map<string, Readonly<{ revision: string | number; until: number }>>();
  let closed = false;
  let generation = 0;
  const revision = (account: AccountRecord) => input.getRevision?.(account) ?? 0;
  const isAccountCurrent = (account: AccountRecord) => {
    try {
      return input.isAccountCurrent?.(account) ?? true;
    } catch {
      return false;
    }
  };
  function partition(account: AccountRecord): string {
    if (account.networkId !== input.networkId || account.identityKind !== 'classic' || account.hidden)
      throw new Error('claimable-account-network-mismatch');
    return JSON.stringify([account.networkId, account.address]);
  }
  function readCached(account: AccountRecord): ClaimableState | undefined {
    const key = partition(account);
    if (closed || !isAccountCurrent(account)) return undefined;
    const snapshot = input.cache.read(input.networkId, account.address);
    if (!snapshot) return undefined;
    const age = input.now() - snapshot.savedAt;
    const refreshFailed = retryAt.has(key);
    return {
      snapshot,
      stale:
        refreshFailed ||
        age < 0 ||
        age >= CLAIMABLE_TTL_MS ||
        revision(account) !== (savedRevisions.get(key) ?? 0),
      refreshFailed,
    };
  }
  function refresh(account: AccountRecord, force = false): Promise<ClaimableState> {
    if (closed) return Promise.reject(new Error('claimable-reader-closed'));
    const key = partition(account);
    if (!isAccountCurrent(account)) return Promise.reject(new Error('claimable-account-retired'));
    const requestRevision = revision(account);
    const existing = pending.get(key);
    if (existing) {
      if (existing.revision === requestRevision) return existing.request;
      // An older response cannot consume a later invalidation. Wait for its
      // retirement, then coalesce all current consumers into one fresh read.
      return existing.request.then(
        () => refresh(account, force),
        () => refresh(account, force),
      );
    }
    const requestGeneration = generation;
    const isCurrent = () =>
      !closed && requestGeneration === generation && requestRevision === revision(account) && isAccountCurrent(account);
    const current = readCached(account);
    const now = input.now();
    if (!force && current && !current.stale) return Promise.resolve(current);
    const retry = retryAt.get(key);
    if (!force && retry?.revision === requestRevision && now < retry.until) {
      return current
        ? Promise.resolve({ ...current, stale: true, refreshFailed: true })
        : Promise.reject(new Error('claimable-refresh-cooldown'));
    }

    const request = (async () => {
      try {
        const rows: ClaimableRecord[] = [];
        const seenIds = new Set<string>();
        const seenCursors = new Set<string>();
        let cursor: string | undefined;
        let exhausted = false;
        for (let page = 0; page < 20; page += 1) {
          const response = await input.read.page(account.address, cursor);
          if (!isCurrent()) throw new Error('claimable-reader-retired');
          if (!Array.isArray(response.records) || response.records.length > 50)
            throw new Error('claimable-partial-page');
          for (const row of response.records) {
            if (seenIds.has(row.id)) throw new Error('claimable-duplicate-id');
            seenIds.add(row.id);
            rows.push(row);
          }
          if (rows.length > CLAIMABLE_MAX_ROWS) throw new Error('claimable-too-many');
          if (response.records.length < 50) {
            exhausted = true;
            break;
          }
          if (!response.nextCursor || seenCursors.has(response.nextCursor)) throw new Error('claimable-cursor-invalid');
          seenCursors.add(response.nextCursor);
          cursor = response.nextCursor;
        }
        // Never overwrite a complete cached snapshot with a truncated partial listing.
        if (!exhausted) throw new Error('claimable-list-incomplete');
        const snapshot: ClaimableSnapshot = {
          networkId: input.networkId,
          address: account.address,
          savedAt: input.now(),
          records: classifyClaimableSnapshot(rows, Math.floor(input.now() / 1000)),
          everSeen: rows.length > 0 || current?.snapshot.everSeen === true || !!current?.snapshot.records.length,
        };
        if (!isCurrent()) throw new Error('claimable-reader-retired');
        input.cache.replace(snapshot);
        savedRevisions.set(key, requestRevision);
        retryAt.delete(key);
        return { snapshot, stale: false, refreshFailed: false };
      } catch (error) {
        if (!isCurrent()) throw error;
        retryAt.set(key, { revision: requestRevision, until: input.now() + CLAIMABLE_RETRY_MS });
        const saved = readCached(account);
        if (saved) return { ...saved, stale: true, refreshFailed: true };
        throw error;
      }
    })().finally(() => {
      if (pending.get(key)?.request === request) pending.delete(key);
    });
    pending.set(key, { revision: requestRevision, request });
    return request;
  }
  return Object.freeze({
    networkId: input.networkId,
    readCached,
    refresh,
    current: async (account: AccountRecord, id: string) => {
      if (closed) throw new Error('claimable-reader-closed');
      partition(account);
      if (!isAccountCurrent(account)) throw new Error('claimable-account-retired');
      const requestGeneration = generation;
      const result = await input.read.byId(account.address, id);
      if (closed || requestGeneration !== generation || !isAccountCurrent(account))
        throw new Error('claimable-reader-retired');
      return result;
    },
    userSpam: (account: AccountRecord, id: string) => {
      partition(account);
      if (closed || !isAccountCurrent(account)) return undefined;
      return input.cache.userSpam(input.networkId, account.address, id);
    },
    markSpam: (account: AccountRecord, id: string, spam: boolean) => {
      if (closed) throw new Error('claimable-reader-closed');
      partition(account);
      if (!isAccountCurrent(account)) throw new Error('claimable-account-retired');
      input.cache.setUserSpam(input.networkId, account.address, id, spam);
    },
    close: () => {
      closed = true;
      generation += 1;
      pending.clear();
      retryAt.clear();
      savedRevisions.clear();
    },
  });
}
