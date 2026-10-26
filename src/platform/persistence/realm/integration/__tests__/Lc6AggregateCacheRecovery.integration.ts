import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import Realm from 'realm';

import type { AccountRecord } from '../../../../../capabilities/account/types';
import { loadBalanceSnapshot } from '../../../../../capabilities/balance/loadBalanceSnapshot';
import {
  cacheBalanceSnapshotBestEffort,
  readBalanceCacheBestEffort,
} from '../../../../../capabilities/balance/BalanceCacheHydration';
import { loadHistoryPage } from '../../../../../capabilities/history/loadHistoryPage';
import {
  cacheHistoryOnlineEntriesBestEffort,
  readHistoryCacheSnapshotBestEffort,
} from '../../../../../capabilities/history/HistoryCacheHydration';
import { createDisplayReadGateway } from '../../../../../app/readModels/createDisplayReadGateway';
import { createLedgerReadInvalidationStore } from '../../../../../app/readModels/LedgerReadInvalidationStore';
import { createLedgerReadRuntime, type InternetConnectivity } from '../../../../../app/readModels/LedgerReadRuntime';
import { createNodeReadSession } from '../../../../../app/readModels/createNodeReadSession';
import { startLedgerReadLifecycle } from '../../../../../app/readModels/startLedgerReadLifecycle';
import { RealmBalanceCacheRepository } from '../../RealmBalanceCacheRepository';
import { RealmHistoryCacheRepository } from '../../RealmHistoryCacheRepository';
import { openWalletRealm } from '../../openWalletRealm';

const networkId = 'stellar-testnet';
const now = new Date('2026-10-26T00:00:00Z');
const account = (id: string): AccountRecord => ({
  id,
  address: `G${id}`,
  networkId,
  identityKind: 'classic',
  hidden: false,
  label: id,
  sortOrder: 0,
  createdAt: now,
  updatedAt: now,
});
const a = account('A');
const b = account('B');

async function settle() {
  for (let i = 0; i < 35; i++) await Promise.resolve();
}

function createScope(realm: Realm, amount: string, label: string) {
  const runtime = createLedgerReadRuntime();
  runtime.update({ foreground: false, connectivity: 'offline' });
  const invalidation = createLedgerReadInvalidationStore();
  const probe = jest.fn(async () => 'stellar-network-passphrase');
  const balancePort = jest.fn(async (address: string) => ({
    status: 'active' as const,
    address,
    balances: [{ kind: 'native' as const, balance: amount }],
  }));
  const historyPort = jest.fn(async (input: { address: string }) => ({
    status: 'active' as const,
    address: input.address,
    records: [
      {
        id: `operation-${input.address}-${label}`,
        pagingToken: `cursor-${input.address}-${label}`,
        type: 'future_operation',
        occurredAt: now.toISOString(),
        transactionHash: `hash-${input.address}-${label}`,
        sourceAccount: input.address,
      },
    ],
  }));
  const node = createNodeReadSession({
    endpoint: 'https://node.test',
    networkPassphrase: 'stellar-network-passphrase',
    runtime,
    probe,
    onState: jest.fn(),
    random: () => 1,
  });
  const gateway = createDisplayReadGateway({
    runtime,
    getAccountRevision: address => String(invalidation.getRevision(networkId, address === a.address ? a.id : b.id)),
    gateway: {
      loadAccountBalances: address => node.run(() => balancePort(address)),
      loadAccountOperations: input => node.run(() => historyPort(input)),
      loadOperation: async () => ({ status: 'not-found' }),
    },
  });
  const balance = { gateway, networkId, cache: new RealmBalanceCacheRepository(realm), now: () => now };
  const history = { gateway, networkId, cache: new RealmHistoryCacheRepository(realm), now: () => now };
  let onAppState!: (state: string) => void;
  let onConnectivity!: (value: InternetConnectivity) => void;
  const reconcile = jest.fn().mockResolvedValue([]);
  const stop = startLedgerReadLifecycle({
    runtime,
    node,
    invalidation,
    coordinator: { reconcile },
    networkId,
    currentAppState: 'background',
    getAccounts: () => [a, b],
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
  return {
    runtime,
    node,
    probe,
    balancePort,
    historyPort,
    balance,
    history,
    appState: (value: string) => onAppState(value),
    connectivity: (value: InternetConnectivity) => onConnectivity(value),
    async loadAndCache(value: AccountRecord) {
      const snapshot = await loadBalanceSnapshot(balance, value);
      const page = await loadHistoryPage(history, value);
      expect(page.status).toBe('active');
      expect(cacheBalanceSnapshotBestEffort(balance, value, snapshot, now)).toBe(true);
      if (page.status === 'active') {
        expect(cacheHistoryOnlineEntriesBestEffort(history, value, page.entries, now)).toBe(true);
      }
    },
    close() {
      stop();
      node.close();
    },
  };
}

afterAll(() => Realm.shutdown());

it('restores both partitioned display caches after Realm reopen and refreshes only after verified online recovery', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'fresnica-lc6-realm-'));
  const path = join(directory, 'wallet.realm');
  let realm: Realm | undefined;
  try {
    realm = await openWalletRealm({ path });
    const initial = createScope(realm, '1.0000000', 'initial');
    initial.connectivity('online');
    initial.appState('active');
    await settle();
    expect(initial.node.getSnapshot().phase).toBe('healthy');
    await initial.loadAndCache(a);
    await initial.loadAndCache(b);
    initial.close();
    realm.close();
    realm = undefined;

    // Recreate the app's repository and read-service lifetime against the same durable file.
    realm = await openWalletRealm({ path });
    const resumed = createScope(realm, '2.0000000', 'resumed');
    resumed.connectivity('offline');
    resumed.appState('active');
    expect(readBalanceCacheBestEffort(resumed.balance, a)?.balance).toMatchObject({
      status: 'active',
      balances: [{ balance: '1.0000000' }],
    });
    expect(readHistoryCacheSnapshotBestEffort(resumed.history, a)?.entries).toMatchObject([
      { id: 'operation-GA-initial' },
    ]);
    expect(readBalanceCacheBestEffort(resumed.balance, b)?.balance).toMatchObject({
      status: 'active',
      balances: [{ balance: '1.0000000' }],
    });
    expect(readHistoryCacheSnapshotBestEffort(resumed.history, b)?.entries).toMatchObject([
      { id: 'operation-GB-initial' },
    ]);
    await expect(loadBalanceSnapshot(resumed.balance, a)).rejects.toThrow('ledger-read-offline');
    await expect(loadHistoryPage(resumed.history, a)).rejects.toThrow('ledger-read-offline');
    expect(resumed.probe).not.toHaveBeenCalled();
    expect(resumed.balancePort).not.toHaveBeenCalled();
    expect(resumed.historyPort).not.toHaveBeenCalled();

    resumed.connectivity('online');
    await settle();
    expect(resumed.node.getSnapshot().phase).toBe('healthy');
    await resumed.loadAndCache(a);
    expect(readBalanceCacheBestEffort(resumed.balance, a)?.balance).toMatchObject({
      status: 'active',
      balances: [{ balance: '2.0000000' }],
    });
    expect(readHistoryCacheSnapshotBestEffort(resumed.history, a)?.entries).toMatchObject([
      { id: 'operation-GA-resumed' },
    ]);
    expect(readBalanceCacheBestEffort(resumed.balance, b)?.balance).toMatchObject({
      status: 'active',
      balances: [{ balance: '1.0000000' }],
    });
    expect(readHistoryCacheSnapshotBestEffort(resumed.history, b)?.entries).toMatchObject([
      { id: 'operation-GB-initial' },
    ]);
    expect(resumed.balancePort).toHaveBeenCalledTimes(1);
    expect(resumed.historyPort).toHaveBeenCalledTimes(1);
    resumed.close();
  } finally {
    realm?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
