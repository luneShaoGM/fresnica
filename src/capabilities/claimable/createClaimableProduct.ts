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
  }>,
) {
  const pending = new Map<string, Promise<ClaimableState>>();
  const retryAt = new Map<string, number>();
  let closed = false;
  let generation = 0;
  function partition(account: AccountRecord): string {
    if (account.networkId !== input.networkId || account.identityKind !== 'classic' || account.hidden)
      throw new Error('claimable-account-network-mismatch');
    return JSON.stringify([account.networkId, account.address]);
  }
  function readCached(account: AccountRecord): ClaimableState | undefined {
    partition(account);
    const snapshot = input.cache.read(input.networkId, account.address);
    if (!snapshot) return undefined;
    const age = input.now() - snapshot.savedAt;
    return { snapshot, stale: age < 0 || age >= CLAIMABLE_TTL_MS, refreshFailed: false };
  }
  function refresh(account: AccountRecord, force = false): Promise<ClaimableState> {
    if (closed) return Promise.reject(new Error('claimable-reader-closed'));
    const key = partition(account);
    const existing = pending.get(key);
    if (existing) return existing;
    const requestGeneration = generation;
    const current = readCached(account);
    const now = input.now();
    if (!force && current && !current.stale) return Promise.resolve(current);
    if (!force && now < (retryAt.get(key) ?? 0)) {
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
          if (closed || requestGeneration !== generation) throw new Error('claimable-reader-retired');
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
        if (closed || requestGeneration !== generation) throw new Error('claimable-reader-retired');
        input.cache.replace(snapshot);
        retryAt.delete(key);
        return { snapshot, stale: false, refreshFailed: false };
      } catch (error) {
        if (closed || requestGeneration !== generation) throw error;
        retryAt.set(key, input.now() + CLAIMABLE_RETRY_MS);
        const saved = readCached(account);
        if (saved) return { ...saved, stale: true, refreshFailed: true };
        throw error;
      }
    })().finally(() => {
      if (pending.get(key) === request) pending.delete(key);
    });
    pending.set(key, request);
    return request;
  }
  return Object.freeze({
    networkId: input.networkId,
    readCached,
    refresh,
    current: (account: AccountRecord, id: string) => {
      if (closed) return Promise.reject(new Error('claimable-reader-closed'));
      partition(account);
      return input.read.byId(account.address, id);
    },
    userSpam: (account: AccountRecord, id: string) => {
      partition(account);
      return input.cache.userSpam(input.networkId, account.address, id);
    },
    markSpam: (account: AccountRecord, id: string, spam: boolean) => {
      if (closed) throw new Error('claimable-reader-closed');
      partition(account);
      input.cache.setUserSpam(input.networkId, account.address, id, spam);
    },
    close: () => {
      closed = true;
      generation += 1;
      pending.clear();
      retryAt.clear();
    },
  });
}
