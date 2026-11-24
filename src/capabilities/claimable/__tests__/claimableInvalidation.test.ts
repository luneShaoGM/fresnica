import type { AccountRecord } from '../../account/types';
import { createClaimableProduct, type ClaimableCacheStore, type ClaimableReadPort } from '../createClaimableProduct';
import { mapClaimableRecord, type ClaimableSnapshot } from '../records';

const networkId = 'stellar-testnet';
const account: AccountRecord = {
  id: 'account-A',
  address: 'G' + 'A'.repeat(55),
  networkId,
  identityKind: 'classic',
  label: 'A',
  hidden: false,
  sortOrder: 0,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};
const other = { ...account, id: 'account-B', address: 'G' + 'B'.repeat(55) };
const claim = () =>
  mapClaimableRecord(
    {
      id: '00000000' + 'a'.repeat(64),
      asset: 'native',
      amount: '2.0000000',
      sponsor: other.address,
      claimants: [{ destination: account.address, predicate: { unconditional: true } }],
    },
    account.address,
  );

function fixture(
  page: ClaimableReadPort['page'],
  options: { isAccountCurrent?: (target: AccountRecord) => boolean; byId?: ClaimableReadPort['byId'] } = {},
) {
  const key = (network: string, address: string) => JSON.stringify([network, address]);
  const snapshots = new Map<string, ClaimableSnapshot>();
  const revisions = new Map<string, number>();
  const replace = jest.fn((snapshot: ClaimableSnapshot) => snapshots.set(key(snapshot.networkId, snapshot.address), snapshot));
  const cache: ClaimableCacheStore = {
    read: (network, address) => snapshots.get(key(network, address)),
    replace,
    userSpam: () => undefined,
    setUserSpam: () => undefined,
    clearPartition: (network, address) => { snapshots.delete(key(network, address)); },
  };
  const seed = (target = account) => {
    const snapshot: ClaimableSnapshot = {
      networkId,
      address: target.address,
      savedAt: 1_000,
      records: [],
      everSeen: false,
    };
    snapshots.set(key(networkId, target.address), snapshot);
    return snapshot;
  };
  const product = createClaimableProduct({
    networkId,
    cache,
    read: { page, byId: options.byId ?? (async () => undefined) },
    now: () => 2_000,
    getRevision: target => revisions.get(target.id) ?? 0,
    isAccountCurrent: options.isAccountCurrent,
  });
  return { product, revisions, cache, replace, seed };
}

describe('Claimable account-ledger invalidation', () => {
  it('discovers a new claim inside the TTL without refreshing another account partition', async () => {
    const page = jest.fn(async () => ({ records: [claim()] }));
    const { product, seed, revisions } = fixture(page);
    seed();
    const otherSnapshot = seed(other);
    expect((await product.refresh(account)).snapshot.records).toEqual([]);
    expect(page).not.toHaveBeenCalled();

    revisions.set(account.id, 1);
    expect(product.readCached(account)?.stale).toBe(true);
    const found = await product.refresh(account);
    expect(found).toMatchObject({ stale: false, refreshFailed: false, snapshot: { everSeen: true } });
    expect(found.snapshot.records).toHaveLength(1);
    expect((await product.refresh(other)).snapshot).toBe(otherSnapshot);
    expect((await product.refresh(account)).snapshot).toBe(found.snapshot);
    expect(page).toHaveBeenCalledTimes(1);
    expect(page).toHaveBeenCalledWith(account.address, undefined);
    expect(() => product.readCached({ ...account, networkId: 'stellar-mainnet' })).toThrow();
  });

  it('retires an older in-flight response and coalesces later consumers into the latest revision', async () => {
    let finish!: (value: { records: ReturnType<typeof claim>[] }) => void;
    const oldRead = new Promise<{ records: ReturnType<typeof claim>[] }>(resolve => { finish = resolve; });
    const page = jest.fn<ReturnType<ClaimableReadPort['page']>, Parameters<ClaimableReadPort['page']>>()
      .mockReturnValueOnce(oldRead)
      .mockResolvedValue({ records: [claim()] });
    const { product, revisions, replace, seed } = fixture(page);
    const cached = seed();
    const old = product.refresh(account, true);
    const retired = expect(old).rejects.toThrow('claimable-reader-retired');
    revisions.set(account.id, 1);
    const latest = product.refresh(account);
    revisions.set(account.id, 2);
    const duplicate = product.refresh(account);
    expect(page).toHaveBeenCalledTimes(1);
    finish({ records: [] });
    await retired;
    const [a, b] = await Promise.all([latest, duplicate]);
    expect(a.snapshot).toBe(b.snapshot);
    expect(a.snapshot).not.toBe(cached);
    expect(a.snapshot.records).toHaveLength(1);
    expect(page).toHaveBeenCalledTimes(2);
    expect(replace).toHaveBeenCalledTimes(1);
    expect(product.readCached(account)?.stale).toBe(false);
  });

  it('retains stale display data on failure, coalesces cooldown, and retries on a new recovery revision', async () => {
    const page = jest.fn<ReturnType<ClaimableReadPort['page']>, Parameters<ClaimableReadPort['page']>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ records: [claim()] });
    const { product, revisions, seed } = fixture(page);
    const cached = seed();
    revisions.set(account.id, 1);
    expect(await product.refresh(account)).toEqual({ snapshot: cached, stale: true, refreshFailed: true });
    expect(product.readCached(account)).toEqual({ snapshot: cached, stale: true, refreshFailed: true });
    await product.refresh(account);
    expect(page).toHaveBeenCalledTimes(1);
    revisions.set(account.id, 2);
    expect(await product.refresh(account)).toMatchObject({ stale: false, refreshFailed: false });
    expect(page).toHaveBeenCalledTimes(2);
    expect(product.readCached(account)?.refreshFailed).toBe(false);
  });

  it('never starts a queued current-revision request after the product closes', async () => {
    let finish!: (value: { records: [] }) => void;
    const page = jest.fn(() => new Promise<{ records: [] }>(resolve => { finish = resolve; }));
    const { product, revisions, replace } = fixture(page);
    const old = product.refresh(account);
    const oldRejected = expect(old).rejects.toThrow('claimable-reader-retired');
    revisions.set(account.id, 1);
    const next = product.refresh(account);
    const nextRejected = expect(next).rejects.toThrow('claimable-reader-closed');
    product.close();
    finish({ records: [] });
    await Promise.all([oldRejected, nextRejected]);
    expect(page).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalled();
  });

  it('rejects a delayed detail result and all old-account operations after deletion', async () => {
    let live = true;
    let finish!: (value: ReturnType<typeof claim>) => void;
    const page = jest.fn(async () => ({ records: [claim()] }));
    const byId = jest.fn(() => new Promise<ReturnType<typeof claim>>(resolve => { finish = resolve; }));
    const { product, seed } = fixture(page, { isAccountCurrent: () => live, byId });
    seed();
    const detail = product.current(account, claim().id);
    const rejected = expect(detail).rejects.toThrow('claimable-reader-retired');
    live = false;
    finish(claim());
    await rejected;
    expect(product.readCached(account)).toBeUndefined();
    expect(product.userSpam(account, claim().id)).toBeUndefined();
    expect(() => product.markSpam(account, claim().id, true)).toThrow('claimable-account-retired');
    await expect(product.refresh(account)).rejects.toThrow('claimable-account-retired');
    await expect(product.current(account, claim().id)).rejects.toThrow('claimable-account-retired');
    expect(page).not.toHaveBeenCalled();
    expect(byId).toHaveBeenCalledTimes(1);
  });

  it('fails closed when the account owner cannot be read', async () => {
    const page = jest.fn(async () => ({ records: [] }));
    const { product, seed } = fixture(page, { isAccountCurrent: () => { throw new Error('realm-unavailable'); } });
    seed();
    expect(product.readCached(account)).toBeUndefined();
    await expect(product.refresh(account)).rejects.toThrow('claimable-account-retired');
    expect(page).not.toHaveBeenCalled();
  });
});
