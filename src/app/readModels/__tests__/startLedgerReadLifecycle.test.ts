import type { AccountRecord } from '@capabilities/account/types';

import { createLedgerReadInvalidationStore } from '../LedgerReadInvalidationStore';
import { createLedgerReadRuntime, type InternetConnectivity } from '../LedgerReadRuntime';
import { createNodeReadSession } from '../createNodeReadSession';
import { NodeReadError } from '@capabilities/network/NodeReadError';
import { startLedgerReadLifecycle } from '../startLedgerReadLifecycle';

const account = (id: string, networkId = 'stellar-testnet', hidden = false): AccountRecord => ({
  id,
  networkId,
  hidden,
  address: `G${id}`,
  identityKind: 'classic',
  label: id,
  sortOrder: 0,
  createdAt: new Date(0),
  updatedAt: new Date(0),
});

function setup(currentAppState = 'active') {
  const runtime = createLedgerReadRuntime();
  const invalidation = createLedgerReadInvalidationStore();
  const reconcile = jest.fn().mockResolvedValue([]);
  const failure = jest.fn();
  let accounts = [account('one'), account('hidden', 'stellar-testnet', true), account('mainnet', 'stellar-mainnet')];
  let appState!: (state: string) => void;
  let connectivity!: (state: InternetConnectivity) => void;
  const stopAppState = jest.fn();
  const stopConnectivity = jest.fn();
  const stop = startLedgerReadLifecycle({
    runtime,
    invalidation,
    coordinator: { reconcile },
    networkId: 'stellar-testnet',
    currentAppState,
    getAccounts: () => accounts,
    onFailure: failure,
    subscribeAppState: listener => {
      appState = listener;
      return stopAppState;
    },
    subscribeConnectivity: listener => {
      connectivity = listener;
      return stopConnectivity;
    },
  });
  return {
    runtime,
    invalidation,
    reconcile,
    failure,
    stop,
    stopAppState,
    stopConnectivity,
    appState: (state: string) => appState(state),
    connectivity: (state: InternetConnectivity) => connectivity(state),
    setAccounts: (next: AccountRecord[]) => {
      accounts = next;
    },
  };
}

describe('ledger read lifecycle', () => {
  it('refreshes visible current-network reads even when reconciliation returns no pending transactions', async () => {
    const current = setup();
    expect(current.invalidation.getRevision('stellar-testnet', 'one')).toBe(1);
    current.appState('background');
    expect(current.runtime.getSnapshot().foreground).toBe(false);
    current.appState('active');
    await Promise.resolve();
    expect(current.invalidation.getRevision('stellar-testnet', 'one')).toBe(2);
    expect(current.invalidation.getRevision('stellar-testnet', 'hidden')).toBe(0);
    expect(current.invalidation.getRevision('stellar-mainnet', 'mainnet')).toBe(0);
    expect(current.reconcile.mock.calls).toEqual([['cold-start'], ['foreground']]);
    current.stop();
  });

  it('recovers an initial failed read on the first definitive online event, not only offline-to-online', () => {
    const current = setup();
    current.connectivity('unknown');
    expect(current.invalidation.getRevision('stellar-testnet', 'one')).toBe(1);
    current.connectivity('online');
    current.connectivity('online');
    expect(current.invalidation.getRevision('stellar-testnet', 'one')).toBe(2);
    expect(current.reconcile).toHaveBeenLastCalledWith('network-recovery');
    current.stop();
  });

  it('keeps definite offline through unknown and restores reads only on online', () => {
    const current = setup();
    current.connectivity('offline');
    current.connectivity('unknown');
    expect(current.runtime.getSnapshot()).toEqual({ foreground: true, connectivity: 'offline' });
    expect(current.reconcile).toHaveBeenCalledTimes(1);
    current.connectivity('online');
    expect(current.runtime.getSnapshot().connectivity).toBe('online');
    expect(current.reconcile).toHaveBeenCalledTimes(2);
    current.stop();
  });

  it('defers recovery while backgrounded and refreshes the latest account inventory on resume', () => {
    const current = setup('background');
    current.connectivity('offline');
    current.connectivity('online');
    expect(current.reconcile).not.toHaveBeenCalled();
    expect(current.invalidation.getRevision('stellar-testnet', 'one')).toBe(0);
    current.setAccounts([account('two')]);
    current.appState('active');
    expect(current.invalidation.getRevision('stellar-testnet', 'one')).toBe(0);
    expect(current.invalidation.getRevision('stellar-testnet', 'two')).toBe(1);
    expect(current.reconcile).toHaveBeenCalledTimes(1);
    current.stop();
  });

  it('does not treat duplicate active callbacks as foreground resumes and cleans up late callbacks', () => {
    const current = setup();
    current.appState('active');
    expect(current.reconcile).toHaveBeenCalledTimes(1);
    current.stop();
    current.stop();
    current.appState('active');
    current.connectivity('online');
    expect(current.runtime.getSnapshot().foreground).toBe(false);
    expect(current.stopAppState).toHaveBeenCalledTimes(1);
    expect(current.stopConnectivity).toHaveBeenCalledTimes(1);
    expect(current.reconcile).toHaveBeenCalledTimes(1);
  });

  it('does not wait for pending-transaction lookup before invalidating reads', async () => {
    const current = setup();
    current.reconcile.mockRejectedValueOnce(new Error('gateway-unavailable'));
    current.appState('inactive');
    current.appState('active');
    expect(current.invalidation.getRevision('stellar-testnet', 'one')).toBe(2);
    await Promise.resolve();
    expect(current.failure).toHaveBeenCalledTimes(1);
    current.stop();
  });
  it('cleans up an installed app listener if connectivity subscription fails', () => {
    const runtime = createLedgerReadRuntime();
    const stopAppState = jest.fn();
    expect(() =>
      startLedgerReadLifecycle({
        runtime,
        invalidation: createLedgerReadInvalidationStore(),
        coordinator: { reconcile: jest.fn().mockResolvedValue([]) },
        networkId: 'stellar-testnet',
        currentAppState: 'background',
        getAccounts: () => [],
        onFailure: jest.fn(),
        subscribeAppState: () => stopAppState,
        subscribeConnectivity: () => {
          throw new Error('native-subscribe-failed');
        },
      }),
    ).toThrow('native-subscribe-failed');
    expect(stopAppState).toHaveBeenCalledTimes(1);
    expect(runtime.getSnapshot().foreground).toBe(false);
  });
});

it('defers pending recovery until node verification and repeats it after cooldown/resume', async () => {
  jest.useFakeTimers();
  const runtime = createLedgerReadRuntime();
  const node = createNodeReadSession({
    runtime,
    endpoint: 'https://node.test',
    networkPassphrase: 'test',
    probe: async () => 'test',
    onState: jest.fn(),
    random: () => 1,
  });
  const reconcile = jest.fn().mockResolvedValue([]);
  let appState!: (state: string) => void;
  const stop = startLedgerReadLifecycle({
    runtime,
    node,
    invalidation: createLedgerReadInvalidationStore(),
    coordinator: { reconcile },
    networkId: 'stellar-testnet',
    currentAppState: 'active',
    getAccounts: () => [account('one')],
    onFailure: jest.fn(),
    subscribeAppState: listener => {
      appState = listener;
      return () => {};
    },
    subscribeConnectivity: () => () => {},
  });
  const settle = async () => {
    for (let i = 0; i < 30; i++) await Promise.resolve();
  };
  expect(reconcile).not.toHaveBeenCalled();
  await settle();
  expect(reconcile.mock.calls).toEqual([['node-recovery']]);
  node.reportFailure(new NodeReadError('rate-limited', 5000), node.getSnapshot().generation);
  appState('background');
  appState('active');
  expect(reconcile).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(4999);
  await settle();
  expect(reconcile).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(1);
  await settle();
  expect(reconcile).toHaveBeenCalledTimes(2);
  appState('background');
  appState('active');
  await settle();
  expect(reconcile).toHaveBeenCalledTimes(3);
  stop();
  node.close();
  await settle();
  expect(reconcile).toHaveBeenCalledTimes(3);
  expect(jest.getTimerCount()).toBe(0);
  jest.useRealTimers();
});
