import type { AccountRecord } from '../../account/types';
import { claimAvailability, parseClaimPredicate } from '../predicate';
import { createClaimableProduct, type ClaimableCacheStore } from '../createClaimableProduct';
import {
  classifyClaimableSnapshot,
  displayedClaimable,
  mapClaimableRecord,
  parseClaimableSnapshot,
  type ClaimableRecord,
  type ClaimableSnapshot,
} from '../records';

const address = 'G' + 'A'.repeat(55);
const issuer = 'G' + 'B'.repeat(55);
const networkId = 'stellar-testnet';
const id = '00000000' + 'a'.repeat(64);
const account: AccountRecord = {
  id: 'account-A',
  address,
  networkId,
  identityKind: 'classic',
  label: 'A',
  sortOrder: 0,
  hidden: false,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};
const raw = (input: Record<string, unknown> = {}) => ({
  id,
  amount: '1.0000000',
  sponsor: issuer,
  asset: 'native',
  claimants: [{ destination: address, predicate: { unconditional: true } }],
  ...input,
});
const record = () => mapClaimableRecord(raw(), address);

describe('S11 bounded predicate and authoritative record parsing', () => {
  it('evaluates absolute and nested predicates without guessing', () => {
    expect(claimAvailability(parseClaimPredicate({ not: { abs_before: '100' } }), 90)).toEqual({
      kind: 'locked',
      nextAt: 100,
    });
    expect(
      claimAvailability(parseClaimPredicate({ and: [{ unconditional: true }, { abs_before: '100' }] }), 99).kind,
    ).toBe('claimable');
    expect(claimAvailability(parseClaimPredicate({ rel_before: '100' }), 90).kind).toBe('unknown');
    expect(claimAvailability(parseClaimPredicate({ rel_before: '100' }), 90, 0).kind).toBe('claimable');
    expect(claimAvailability(parseClaimPredicate({ rel_before: '100' }), 100, 0).kind).toBe('unclaimable');
    expect(claimAvailability(parseClaimPredicate({ unknown: true }), 1).kind).toBe('unknown');
    expect(parseClaimPredicate({ or: Array(33).fill({ unconditional: true }) })).toBeUndefined();
    let deeplyNested: unknown = { unconditional: true };
    for (let i = 0; i < 15; i++) deeplyNested = { not: deeplyNested };
    expect(parseClaimPredicate(deeplyNested)).toBeUndefined();
  });

  it('rejects wrong claimant and damaged rows rather than claiming another account', () => {
    expect(() =>
      mapClaimableRecord(raw({ claimants: [{ destination: issuer, predicate: { unconditional: true } }] }), address),
    ).toThrow('claimable-claimant-mismatch');
    expect(() =>
      mapClaimableRecord(raw({ claimants: [{ destination: address }, { destination: address }] }), address),
    ).toThrow('claimable-claimant-mismatch');
    expect(() => mapClaimableRecord(raw({ amount: '-1.0' }), address)).toThrow('claimable-record-invalid');
    expect(() => mapClaimableRecord(raw({ asset: 'USD:' + issuer.toLowerCase() }), address)).toThrow(
      'claimable-asset-invalid',
    );
  });

  it('distinguishes suspicious/spam assets, explicit user display overrides and corrupted cache', () => {
    const item = mapClaimableRecord(raw({ asset: 'USD:' + issuer, amount: '100000.0000000' }), address);
    const classified = classifyClaimableSnapshot([item], 300)[0];
    expect(classified.risk).toBe('SPAM');
    expect(displayedClaimable(classified, 300, { userSpam: false }).risk).toBe('SUSPECT');
    expect(displayedClaimable(classified, 300, { userSpam: true }).risk).toBe('SPAM');
    const saved = { networkId, address, savedAt: 1000, records: [classified] };
    expect(parseClaimableSnapshot(saved, networkId, address)?.records[0].risk).toBe('SPAM');
    expect(parseClaimableSnapshot(saved, 'stellar-mainnet', address)).toBeUndefined();
    expect(
      parseClaimableSnapshot({ ...saved, records: [{ ...classified, claimant: issuer }] }, networkId, address),
    ).toBeUndefined();
  });
});

describe('S11 snapshot lifecycle and partition isolation', () => {
  let cached: ClaimableSnapshot | undefined;
  let spam = new Map<string, boolean>();
  const cache: ClaimableCacheStore = {
    read: (network, addr) => (network === networkId && addr === address ? cached : undefined),
    replace: snapshot => {
      cached = snapshot;
    },
    userSpam: (_network, _address, balanceId) => spam.get(balanceId),
    setUserSpam: (_network, _address, balanceId, value) => {
      spam.set(balanceId, value);
    },
  };
  beforeEach(() => {
    cached = undefined;
    spam = new Map();
  });

  it('uses a 1h cache and isolates current network/account', async () => {
    const page = jest.fn(async () => ({ records: [record()] }));
    const product = createClaimableProduct({
      networkId,
      read: { page, byId: async () => record() },
      cache,
      now: () => 1000,
    });
    expect((await product.refresh(account)).snapshot.records).toHaveLength(1);
    expect((await product.refresh(account)).stale).toBe(false);
    expect(page).toHaveBeenCalledTimes(1);
    expect(() => product.readCached({ ...account, networkId: 'stellar-mainnet' })).toThrow();
    product.markSpam(account, id, true);
    expect(product.userSpam(account, id)).toBe(true);
    product.close();
    await expect(product.refresh(account)).rejects.toThrow('claimable-reader-closed');
  });

  it('keeps current-account category discovery after the last Claimable disappears', async () => {
    let time = 1_000;
    let discovered = true;
    const page = jest.fn(async () => ({ records: discovered ? [record()] : [] }));
    const product = createClaimableProduct({
      networkId,
      read: { page, byId: async () => undefined },
      cache,
      now: () => time,
    });
    const first = await product.refresh(account, true);
    expect(first.snapshot).toMatchObject({ everSeen: true });
    discovered = false;
    time += 3_600_000;
    const empty = await product.refresh(account, true);
    expect(empty.snapshot.records).toHaveLength(0);
    expect(empty.snapshot.everSeen).toBe(true);
    expect(parseClaimableSnapshot(empty.snapshot, networkId, address)?.everSeen).toBe(true);
    expect(parseClaimableSnapshot(empty.snapshot, 'stellar-mainnet', address)).toBeUndefined();
    expect(parseClaimableSnapshot({ ...empty.snapshot, everSeen: 'yes' }, networkId, address)).toBeUndefined();
  });

  it('never overwrites valid cache after an incomplete page, and preserves only stale display fallback', async () => {
    cached = { networkId, address, savedAt: 1, records: [record()] };
    const page = jest.fn(async (_address: string, _cursor?: string) => ({
      records: Array.from({ length: 50 }, (_, index) => ({
        ...record(),
        id: '00000000' + index.toString(16).padStart(64, '0'),
      })),
      nextCursor: '1',
    }));
    const product = createClaimableProduct({
      networkId,
      read: { page, byId: async () => undefined },
      cache,
      now: () => 4_000_000,
    });
    const outcome = await product.refresh(account, true);
    expect(outcome).toMatchObject({ stale: true, refreshFailed: true });
    expect(outcome.snapshot).toBe(cached);
    expect(cached.records).toHaveLength(1);
    expect(page).toHaveBeenCalledTimes(2);
  });

  it('retires an in-flight request after closing and does not persist a late response', async () => {
    let complete!: (value: { records: ClaimableRecord[] }) => void;
    const deferred = new Promise<{ records: ClaimableRecord[] }>(resolve => {
      complete = resolve;
    });
    const product = createClaimableProduct({
      networkId,
      read: { page: () => deferred, byId: async () => undefined },
      cache,
      now: () => 1000,
    });
    const waiting = product.refresh(account, true);
    product.close();
    complete({ records: [record()] });
    await expect(waiting).rejects.toThrow('claimable-reader-retired');
    expect(cached).toBeUndefined();
  });
});
