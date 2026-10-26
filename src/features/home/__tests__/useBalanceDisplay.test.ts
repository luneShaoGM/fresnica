import type { AccountRecord } from '@capabilities/account/types';
import type { StellarAccountBalanceResult } from '@capabilities/stellar/types';
import { InMemoryBalanceCacheRepository } from '../../../platform/persistence/memory/InMemoryBalanceCacheRepository';
import {
  balancePartition,
  balanceSnapshot,
} from '../../../platform/persistence/__tests__/balanceCacheRepositoryContract';
import { useBalanceDisplay } from '../useBalanceDisplay';

type Slot = { value?: unknown; deps?: readonly unknown[]; cleanup?: () => void };
let mockSlots: Slot[] = [];
let mockCursor = 0;
let mockEffects: Array<() => void> = [];
const mockSameDeps = (a: readonly unknown[] | undefined, b: readonly unknown[]) =>
  a !== undefined && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
jest.mock('react', () => ({
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

const accountA: AccountRecord = {
  id: 'a',
  networkId: 'stellar-testnet',
  address: 'GA',
  identityKind: 'classic',
  label: 'A',
  sortOrder: 0,
  hidden: false,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};
const active = (address = 'GA'): StellarAccountBalanceResult => ({
  status: 'active',
  address,
  balances: [{ kind: 'native', balance: '2.0000000' }],
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => {
    resolve = done;
  });
  return { promise, resolve };
}
async function settle() {
  for (let i = 0; i < 12; i++) await Promise.resolve();
}
function setup() {
  const cache = new InMemoryBalanceCacheRepository();
  const gateway = { loadAccountBalances: jest.fn(async (address: string) => active(address)) };
  const deps = { cache, gateway, networkId: 'stellar-testnet', now: () => new Date('2026-10-26T01:00:00Z') };
  const useRender = (account = accountA, activeScreen = true, revision = 0) => {
    mockCursor = 0;
    return useBalanceDisplay(account, deps, activeScreen, revision);
  };
  const effects = () => {
    const pending = mockEffects;
    mockEffects = [];
    pending.forEach(effect => effect());
  };
  const dispose = () => mockSlots.forEach(slot => slot.cleanup?.());
  return { cache, gateway, deps, render: useRender, effects, dispose };
}

beforeEach(() => {
  mockSlots = [];
  mockCursor = 0;
  mockEffects = [];
});
describe('Balance display product lifecycle', () => {
  it('restores cache while loading and replaces it only with an accepted live snapshot', async () => {
    const current = setup();
    const response = deferred<StellarAccountBalanceResult>();
    current.cache.replaceSnapshot(balancePartition, balanceSnapshot());
    current.gateway.loadAccountBalances.mockReturnValueOnce(response.promise);
    current.render();
    current.effects();
    expect(current.render().state).toMatchObject({
      kind: 'ready',
      stale: true,
      refreshing: true,
      snapshot: balanceSnapshot().balance,
    });
    await settle();
    response.resolve(active());
    await settle();
    expect(current.render().state).toMatchObject({
      kind: 'ready',
      stale: false,
      refreshing: false,
      refreshFailed: false,
    });
    expect(current.cache.getSnapshot(balancePartition)?.balance).toMatchObject({
      balances: [{ balance: '2.0000000' }],
    });
  });
  it('retains previous data/time on refresh failure, then retries through the same live loader', async () => {
    const current = setup();
    current.cache.replaceSnapshot(balancePartition, balanceSnapshot());
    current.gateway.loadAccountBalances.mockRejectedValueOnce(new Error('offline'));
    current.render();
    current.effects();
    await settle();
    const failed = current.render();
    expect(failed.state).toMatchObject({
      kind: 'ready',
      stale: true,
      refreshFailed: true,
      lastSuccessfulUpdateAt: balanceSnapshot().lastSuccessfulUpdateAt,
      snapshot: balanceSnapshot().balance,
    });
    failed.refresh();
    await settle();
    expect(current.render().state).toMatchObject({ kind: 'ready', stale: false, refreshFailed: false });
    expect(current.gateway.loadAccountBalances).toHaveBeenCalledTimes(2);
  });
  it('shows an error when no matching successful snapshot exists', async () => {
    const current = setup();
    current.gateway.loadAccountBalances.mockRejectedValueOnce(new Error('offline'));
    current.render();
    current.effects();
    await settle();
    expect(current.render().state).toMatchObject({ kind: 'error' });
    expect(current.cache.getSnapshot(balancePartition)).toBeUndefined();
  });
  it('does not present or write a previous account response after switching accounts', async () => {
    const current = setup();
    current.cache.replaceSnapshot(balancePartition, balanceSnapshot());
    const old = deferred<StellarAccountBalanceResult>();
    current.gateway.loadAccountBalances.mockReturnValueOnce(old.promise);
    current.render();
    current.effects();
    await settle();
    const accountB = { ...accountA, id: 'b', address: 'GB' };
    expect(current.render(accountB).state).toEqual({ kind: 'loading' });
    current.effects();
    await settle();
    old.resolve(active());
    await settle();
    expect(current.render(accountB).state).toMatchObject({ kind: 'ready', snapshot: { address: 'GB' } });
    expect(current.cache.getSnapshot(balancePartition)).toEqual(balanceSnapshot());
  });
  it('does not write after disposal or restart from a retained callback', async () => {
    const current = setup();
    const response = deferred<StellarAccountBalanceResult>();
    current.gateway.loadAccountBalances.mockReturnValueOnce(response.promise);
    const screen = current.render();
    current.effects();
    await settle();
    current.dispose();
    response.resolve(active());
    await settle();
    screen.refresh();
    await settle();
    expect(current.cache.getSnapshot(balancePartition)).toBeUndefined();
    expect(current.gateway.loadAccountBalances).toHaveBeenCalledTimes(1);
  });
  it('keeps a successful online result when cache writing fails', async () => {
    const current = setup();
    current.cache.replaceSnapshot = () => {
      throw new Error('disk-full');
    };
    current.render();
    current.effects();
    await settle();
    expect(current.render().state).toMatchObject({ kind: 'ready', stale: false, snapshot: { status: 'active' } });
  });
  it('replaces a previously active cache with an authoritative inactive result', async () => {
    const current = setup();
    current.cache.replaceSnapshot(balancePartition, balanceSnapshot());
    current.gateway.loadAccountBalances.mockResolvedValueOnce({ status: 'inactive', address: 'GA' });
    current.render();
    current.effects();
    await settle();
    expect(current.render().state).toMatchObject({ kind: 'ready', stale: false, snapshot: { status: 'inactive' } });
    expect(current.cache.getSnapshot(balancePartition)?.balance).toEqual({ status: 'inactive', address: 'GA' });
  });
  it('marks a successful display stale when invalidated and rejects the older pending refresh', async () => {
    const current = setup();
    current.render();
    current.effects();
    await settle();
    const response = deferred<StellarAccountBalanceResult>();
    current.gateway.loadAccountBalances.mockReturnValueOnce(response.promise);
    current.render(accountA, true, 1);
    current.effects();
    await settle();
    expect(current.render(accountA, true, 1).state).toMatchObject({ kind: 'ready', stale: true, refreshing: true });
    current.render(accountA, true, 2);
    current.effects();
    await settle();
    response.resolve({ status: 'inactive', address: 'GA' });
    await settle();
    expect(current.render(accountA, true, 2).state).toMatchObject({
      kind: 'ready',
      stale: false,
      snapshot: { status: 'active' },
    });
  });
});
