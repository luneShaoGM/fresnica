import type { AccountRecord } from '@capabilities/account/types';
import type { StellarAccountBalanceResult } from '@capabilities/stellar/types';
import type { HistoryOperationResult } from '@capabilities/history/HistoryGateway';
import { loadBalanceSnapshot } from '@capabilities/balance/loadBalanceSnapshot';
import {
  cacheBalanceSnapshotBestEffort,
  readBalanceCacheBestEffort,
} from '@capabilities/balance/BalanceCacheHydration';
import { loadHistoryPage } from '@capabilities/history/loadHistoryPage';
import {
  cacheHistoryOnlineEntriesBestEffort,
  readHistoryCacheSnapshotBestEffort,
} from '@capabilities/history/HistoryCacheHydration';
import { HISTORY_CACHE_SCHEMA_VERSION } from '@capabilities/history/HistoryCacheRepository';
import { InMemoryBalanceCacheRepository } from '../../../platform/persistence/memory/InMemoryBalanceCacheRepository';
import { InMemoryHistoryCacheRepository } from '../../../platform/persistence/memory/InMemoryHistoryCacheRepository';
import { createDisplayReadGateway } from '../createDisplayReadGateway';
import { createLedgerReadInvalidationStore } from '../LedgerReadInvalidationStore';
import { createLedgerReadRuntime, type InternetConnectivity } from '../LedgerReadRuntime';
import { createNodeReadSession } from '../createNodeReadSession';
import { startLedgerReadLifecycle } from '../startLedgerReadLifecycle';

const networkId = 'stellar-testnet';
const timestamp = new Date('2026-10-26T00:00:00Z');
const account = (id: string, network = networkId): AccountRecord => ({
  id,
  networkId: network,
  address: `G${id}`,
  identityKind: 'classic',
  hidden: false,
  label: id,
  sortOrder: 0,
  createdAt: timestamp,
  updatedAt: timestamp,
});
const a = account('A');
const b = account('B');
const mainnet = account('A', 'stellar-mainnet');
const partition = (value: AccountRecord) => ({ networkId: value.networkId, accountAddress: value.address });
const balances = (address: string, amount = '5.0000000'): StellarAccountBalanceResult => ({
  status: 'active',
  address,
  balances: [{ kind: 'native', balance: amount }],
});
const history = (address: string): HistoryOperationResult => ({
  status: 'active',
  address,
  records: [
    {
      id: `op-${address}`,
      pagingToken: `page-${address}`,
      type: 'future_operation',
      occurredAt: '2026-10-26T00:00:00Z',
      transactionHash: `tx-${address}`,
      sourceAccount: address,
    },
  ],
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => {
    resolve = done;
  });
  return { promise, resolve };
}
async function settle() {
  for (let i = 0; i < 50; i++) await Promise.resolve();
}

function setup() {
  const runtime = createLedgerReadRuntime();
  runtime.update({ foreground: false, connectivity: 'unknown' });
  const invalidation = createLedgerReadInvalidationStore();
  const balanceCache = new InMemoryBalanceCacheRepository();
  const historyCache = new InMemoryHistoryCacheRepository();
  const probe = jest.fn(async () => 'test-network');
  const node = createNodeReadSession({
    runtime,
    endpoint: 'https://node.test',
    networkPassphrase: 'test-network',
    probe,
    onState: jest.fn(),
    random: () => 1,
  });
  const liveBalances = jest.fn(async (address: string): Promise<StellarAccountBalanceResult> => balances(address));
  const liveHistory = jest.fn(async (input: { address: string }): Promise<HistoryOperationResult> =>
    history(input.address),
  );
  const display = createDisplayReadGateway({
    runtime,
    getAccountRevision: address =>
      JSON.stringify(
        [a, b].filter(item => item.address === address).map(item => invalidation.getRevision(networkId, item.id)),
      ),
    gateway: {
      loadAccountBalances: address => node.run(() => liveBalances(address)),
      loadAccountOperations: input => node.run(() => liveHistory(input)),
      loadOperation: () => Promise.resolve({ status: 'not-found' }),
    },
  });
  const balanceDeps = { gateway: display, networkId, cache: balanceCache, now: () => timestamp };
  const historyDeps = { gateway: display, networkId, cache: historyCache, now: () => timestamp };
  let onAppState!: (state: string) => void;
  let onConnectivity!: (state: InternetConnectivity) => void;
  const reconcile = jest.fn().mockResolvedValue([]);
  const stop = startLedgerReadLifecycle({
    runtime,
    node,
    invalidation,
    coordinator: { reconcile },
    networkId,
    getAccounts: () => [a, b, mainnet],
    currentAppState: 'background',
    subscribeAppState: listener => {
      onAppState = listener;
      return () => {};
    },
    subscribeConnectivity: listener => {
      onConnectivity = listener;
      return () => {};
    },
    onFailure: jest.fn(),
  });
  const saveBalance = async (value: AccountRecord) => {
    const snapshot = await loadBalanceSnapshot(balanceDeps, value);
    cacheBalanceSnapshotBestEffort(balanceDeps, value, snapshot, timestamp);
    return snapshot;
  };
  const saveHistory = async (value: AccountRecord) => {
    const page = await loadHistoryPage(historyDeps, value);
    if (page.status === 'active') cacheHistoryOnlineEntriesBestEffort(historyDeps, value, page.entries, timestamp);
    return page;
  };
  return {
    runtime,
    node,
    probe,
    invalidation,
    reconcile,
    balanceCache,
    historyCache,
    balanceDeps,
    historyDeps,
    liveBalances,
    liveHistory,
    appState: (state: string) => onAppState(state),
    connectivity: (state: InternetConnectivity) => onConnectivity(state),
    saveBalance,
    saveHistory,
    close: async () => {
      stop();
      node.close();
      await settle();
      expect(jest.getTimerCount()).toBe(0);
    },
  };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('LC6-A merged lifecycle / node / display / cache contract', () => {
  it('hydrates only matching offline snapshots, then revalidates both read models after online recovery', async () => {
    const current = setup();
    current.balanceCache.replaceSnapshot(partition(a), {
      schemaVersion: 1,
      lastSuccessfulUpdateAt: timestamp,
      balance: {
        status: 'active',
        address: a.address,
        balances: [{ asset: { kind: 'native', code: 'XLM' }, balance: '1.0000000' }],
        hiddenLiquidityPoolShareCount: 0,
      },
    });
    current.historyCache.replaceSnapshot(partition(a), {
      schemaVersion: HISTORY_CACHE_SCHEMA_VERSION,
      lastSuccessfulHorizonUpdateAt: timestamp,
      entries: [],
      details: [],
    });
    current.balanceCache.replaceSnapshot(partition(mainnet), {
      schemaVersion: 1,
      lastSuccessfulUpdateAt: timestamp,
      balance: { status: 'inactive', address: mainnet.address },
    });
    current.connectivity('offline');
    current.appState('active');
    expect(readBalanceCacheBestEffort(current.balanceDeps, a)?.balance.status).toBe('active');
    expect(readHistoryCacheSnapshotBestEffort(current.historyDeps, a)?.entries).toEqual([]);
    expect(readBalanceCacheBestEffort(current.balanceDeps, b)).toBeUndefined();
    expect(readHistoryCacheSnapshotBestEffort(current.historyDeps, b)).toBeUndefined();
    await expect(current.saveBalance(a)).rejects.toThrow('ledger-read-offline');
    await expect(current.saveHistory(a)).rejects.toThrow('ledger-read-offline');
    expect(current.probe).not.toHaveBeenCalled();
    expect(current.liveBalances).not.toHaveBeenCalled();
    expect(current.liveHistory).not.toHaveBeenCalled();

    current.connectivity('online');
    await settle();
    expect(current.node.getSnapshot().phase).toBe('healthy');
    expect(current.invalidation.getRevision(networkId, a.id)).toBeGreaterThan(0);
    expect((await current.saveBalance(a)).status).toBe('active');
    expect((await current.saveHistory(a)).status).toBe('active');
    expect(readBalanceCacheBestEffort(current.balanceDeps, a)?.balance).toMatchObject({
      status: 'active',
      balances: [{ balance: '5.0000000' }],
    });
    expect(readHistoryCacheSnapshotBestEffort(current.historyDeps, a)?.entries).toMatchObject([
      { id: `op-${a.address}` },
    ]);
    expect(current.balanceCache.getSnapshot(partition(mainnet))?.balance.status).toBe('inactive');
    expect(current.historyCache.getSnapshot(partition(b))).toBeUndefined();
    expect(current.reconcile).toHaveBeenCalledWith('node-recovery');
    await current.close();
  });

  it('discards late A reads on background/offline while B recovers without writing A cache', async () => {
    const current = setup();
    current.connectivity('online');
    current.appState('active');
    await settle();
    expect(current.node.getSnapshot().phase).toBe('healthy');

    const oldBalance = deferred<StellarAccountBalanceResult>();
    const oldHistory = deferred<HistoryOperationResult>();
    current.liveBalances.mockReturnValueOnce(oldBalance.promise);
    current.liveHistory.mockReturnValueOnce(oldHistory.promise);
    const staleBalance = current.saveBalance(a).catch((error: unknown) => error);
    const staleHistory = current.saveHistory(a).catch((error: unknown) => error);
    await settle();
    expect(current.liveBalances).toHaveBeenCalledWith(a.address);
    expect(current.liveHistory).toHaveBeenCalledWith(expect.objectContaining({ address: a.address }));
    current.appState('background');
    current.connectivity('offline');
    const oldBalanceOutcome = await staleBalance;
    const oldHistoryOutcome = await staleHistory;
    expect(oldBalanceOutcome).toMatchObject({ kind: 'superseded' });
    expect(oldHistoryOutcome).toMatchObject({ kind: 'superseded' });
    oldBalance.resolve(balances(a.address, '999.0000000'));
    oldHistory.resolve(history(a.address));
    await settle();
    expect(current.balanceCache.getSnapshot(partition(a))).toBeUndefined();
    expect(current.historyCache.getSnapshot(partition(a))).toBeUndefined();

    current.connectivity('online');
    expect(current.node.getSnapshot().phase).toBe('paused');
    current.appState('active');
    await settle();
    expect(current.node.getSnapshot().phase).toBe('healthy');
    await Promise.all([current.saveBalance(b), current.saveHistory(b)]);
    expect(readBalanceCacheBestEffort(current.balanceDeps, b)?.balance).toMatchObject({
      status: 'active',
      address: b.address,
    });
    expect(readHistoryCacheSnapshotBestEffort(current.historyDeps, b)?.entries).toMatchObject([
      { id: `op-${b.address}` },
    ]);
    expect(current.balanceCache.getSnapshot(partition(a))).toBeUndefined();
    expect(current.historyCache.getSnapshot(partition(a))).toBeUndefined();
    await current.close();
  });

  it('rejects unverified network reads for both models until a matching endpoint is verified', async () => {
    const current = setup();
    current.probe.mockResolvedValueOnce('different-network');
    current.connectivity('online');
    current.appState('active');
    await settle();
    expect(current.node.getSnapshot().phase).toBe('wrong-network');
    await expect(current.saveBalance(a)).rejects.toMatchObject({ kind: 'cooldown' });
    await expect(current.saveHistory(a)).rejects.toMatchObject({ kind: 'cooldown' });
    expect(current.liveBalances).not.toHaveBeenCalled();
    expect(current.liveHistory).not.toHaveBeenCalled();
    expect(current.balanceCache.getSnapshot(partition(a))).toBeUndefined();
    expect(current.historyCache.getSnapshot(partition(a))).toBeUndefined();

    current.node.replaceEndpoint('https://verified.test');
    await settle();
    expect(current.node.getSnapshot().phase).toBe('healthy');
    expect(current.probe).toHaveBeenLastCalledWith('https://verified.test', expect.any(AbortSignal));
    await Promise.all([current.saveBalance(a), current.saveHistory(a)]);
    expect(current.balanceCache.getSnapshot(partition(a))).toBeDefined();
    expect(current.historyCache.getSnapshot(partition(a))).toBeDefined();
    await current.close();
  });
});
