import type { AccountRecord } from '@capabilities/account/types';
import type { AccountEffectsPort } from '@capabilities/account-sync/AccountEffects';
import { NodeReadError } from '@capabilities/network/NodeReadError';

import { bindForegroundAccountSync } from '../../navigation/bindForegroundAccountSync';
import { createSwapSelectionStore } from '../../navigation/swapSelectionStore';
import { bindNodeAccountEffects } from '../bindNodeAccountEffects';
import { createDisplayReadGateway } from '../createDisplayReadGateway';
import { createForegroundAccountSync, ACCOUNT_SYNC_TIMING } from '../createForegroundAccountSync';
import { createLedgerReadInvalidationStore } from '../LedgerReadInvalidationStore';
import { createLedgerReadRuntime } from '../LedgerReadRuntime';
import { createNodeReadSession } from '../createNodeReadSession';

const network = { id: 'stellar-testnet', networkPassphrase: 'test-passphrase' };
const account = (id: string): AccountRecord => ({
  id,
  address: `G${id}`,
  networkId: network.id,
  identityKind: 'classic',
  label: id,
  hidden: false,
  sortOrder: 0,
  createdAt: new Date(0),
  updatedAt: new Date(0),
});
const a = account('A');
const b = account('B');

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => {
    resolve = done;
  });
  return { promise, resolve };
}
async function settle() {
  for (let i = 0; i < 70; i++) await Promise.resolve();
}
async function tick(ms: number) {
  jest.advanceTimersByTime(ms);
  await settle();
}

async function setup() {
  const runtime = createLedgerReadRuntime();
  const invalidation = createLedgerReadInvalidationStore();
  const probe = jest.fn(async () => network.networkPassphrase);
  const node = createNodeReadSession({
    endpoint: 'https://first.test',
    networkPassphrase: network.networkPassphrase,
    runtime,
    probe,
    onState: jest.fn(),
    random: () => 1,
  });
  await settle();
  expect(node.getSnapshot().phase).toBe('healthy');

  const balances = jest.fn(async (address: string) => ({ status: 'inactive' as const, address }));
  const history = jest.fn(async (input: { address: string }) => ({
    status: 'inactive' as const,
    address: input.address,
  }));
  const display = createDisplayReadGateway({
    runtime,
    getAccountRevision: address => String(invalidation.getRevision(network.id, address === a.address ? a.id : b.id)),
    gateway: {
      loadAccountBalances: address => node.run(() => balances(address)),
      loadAccountOperations: input => node.run(() => history(input)),
      loadOperation: async () => ({ status: 'not-found' }),
    },
  });

  const streams: Array<Parameters<AccountEffectsPort['open']>[0]> = [];
  const stopped = jest.fn();
  const create = jest.fn((_endpoint: string): AccountEffectsPort => ({
    latest: async () => undefined,
    open: input => {
      streams.push(input);
      return stopped;
    },
  }));
  const sync = createForegroundAccountSync({
    networkId: network.id,
    runtime,
    node,
    effects: bindNodeAccountEffects(node, create),
    invalidation,
    isReading: display.hasPendingReads,
    onFailure: jest.fn(),
    random: () => 1,
  });
  const selection = createSwapSelectionStore();
  const unbind = bindForegroundAccountSync(selection, sync);
  const select = (selectedAccountId: string) => selection.update({ selectedAccountId, accounts: [a, b], network });
  const close = async () => {
    unbind();
    sync.close();
    node.close();
    await settle();
    expect(jest.getTimerCount()).toBe(0);
  };
  return { runtime, invalidation, node, probe, balances, history, display, streams, create, stopped, select, close };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('LC6 selected-account Effects / node / display-read integration', () => {
  it('ignores old account effects and defers B invalidation until its in-flight Balance/History finish', async () => {
    const current = await setup();
    current.select(a.id);
    await settle();
    expect(current.streams).toHaveLength(1);
    current.streams[0].onOpen();
    await tick(ACCOUNT_SYNC_TIMING.coalesce);
    const previousA = current.invalidation.getRevision(network.id, a.id);

    current.select(b.id);
    await settle();
    expect(current.streams).toHaveLength(2);
    current.streams[0].onEffect('old-a-effect');
    await tick(ACCOUNT_SYNC_TIMING.coalesce);
    expect(current.invalidation.getRevision(network.id, a.id)).toBe(previousA);

    const balance = deferred<{ status: 'inactive'; address: string }>();
    const history = deferred<{ status: 'inactive'; address: string }>();
    current.balances.mockReturnValueOnce(balance.promise);
    current.history.mockReturnValueOnce(history.promise);
    const pendingBalance = current.display.loadAccountBalances(b.address);
    const pendingHistory = current.display.loadAccountOperations({ address: b.address, limit: 20 });
    await settle();
    expect(current.display.hasPendingReads(b.address)).toBe(true);

    const priorB = current.invalidation.getRevision(network.id, b.id);
    current.streams[1].onOpen();
    current.streams[1].onEffect('effect-b');
    await tick(ACCOUNT_SYNC_TIMING.coalesce * 2);
    expect(current.invalidation.getRevision(network.id, b.id)).toBe(priorB);
    expect(current.display.hasPendingReads(b.address)).toBe(true);

    balance.resolve({ status: 'inactive', address: b.address });
    history.resolve({ status: 'inactive', address: b.address });
    await Promise.all([pendingBalance, pendingHistory]);
    await tick(ACCOUNT_SYNC_TIMING.coalesce);
    expect(current.invalidation.getRevision(network.id, b.id)).toBe(priorB + 1);
    expect(current.invalidation.getRevision(network.id, a.id)).toBe(previousA);
    expect(current.display.hasPendingReads(b.address)).toBe(false);
    await current.close();
  });

  it('pauses selected-account Effects and public reads during shared Retry-After, then resumes verified B reads', async () => {
    const current = await setup();
    current.select(b.id);
    await settle();
    current.streams[0].onOpen();
    await settle();
    current.streams[0].onFailure('failed', new NodeReadError('rate-limited', 20000));
    await settle();

    expect(current.node.getSnapshot()).toMatchObject({ phase: 'cooldown', failure: 'rate-limited' });
    await expect(current.display.loadAccountBalances(b.address)).rejects.toMatchObject({ kind: 'cooldown' });
    await expect(current.display.loadAccountOperations({ address: b.address, limit: 20 })).rejects.toMatchObject({
      kind: 'cooldown',
    });
    expect(current.balances).not.toHaveBeenCalled();
    expect(current.history).not.toHaveBeenCalled();

    const originalStreamCount = current.streams.length;
    await tick(19999);
    expect(current.streams).toHaveLength(originalStreamCount);
    expect(current.probe).toHaveBeenCalledTimes(1);
    await tick(1);
    expect(current.node.getSnapshot().phase).toBe('healthy');
    expect(current.probe).toHaveBeenCalledTimes(2);
    expect(current.streams).toHaveLength(originalStreamCount + 1);
    current.streams[0].onEffect('late-from-old-node-lease');
    const revision = current.invalidation.getRevision(network.id, b.id);

    await Promise.all([
      current.display.loadAccountBalances(b.address),
      current.display.loadAccountOperations({ address: b.address, limit: 20 }),
    ]);
    expect(current.balances).toHaveBeenCalledTimes(1);
    expect(current.history).toHaveBeenCalledTimes(1);
    expect(current.invalidation.getRevision(network.id, b.id)).toBe(revision);
    await current.close();
  });
});
