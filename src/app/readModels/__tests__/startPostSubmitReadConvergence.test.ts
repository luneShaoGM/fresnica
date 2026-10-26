import type { AccountRecord } from '@capabilities/account/types';
import type { StellarAccountBalanceResult } from '@capabilities/stellar/types';
import type { TransactionReconciliationResult } from '@capabilities/transaction/submission';
import { NodeReadError } from '@capabilities/network/NodeReadError';
import { InMemoryBalanceCacheRepository } from '../../../platform/persistence/memory/InMemoryBalanceCacheRepository';
import { InMemoryHistoryCacheRepository } from '../../../platform/persistence/memory/InMemoryHistoryCacheRepository';
import { InMemoryPendingSubmissionRepository } from '../../../platform/persistence/memory/InMemoryPendingSubmissionRepository';
import { createTransactionReconciliationCoordinator } from '../../transaction/TransactionReconciliationCoordinator';
import { createDisplayReadGateway } from '../createDisplayReadGateway';
import { createLedgerReadRuntime } from '../LedgerReadRuntime';
import { createLedgerReadInvalidationStore } from '../LedgerReadInvalidationStore';
import { createNodeReadSession } from '../createNodeReadSession';
import { startPostSubmitReadConvergence, POST_SUBMIT_READ_TIMING as timing } from '../startPostSubmitReadConvergence';

const account: AccountRecord = {
  id: 'a',
  address: 'Ga',
  networkId: 'testnet',
  identityKind: 'classic',
  hidden: false,
  label: 'A',
  sortOrder: 0,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};
const operation = {
  id: 'operation',
  pagingToken: 'opaque',
  type: 'payment',
  occurredAt: '2026-10-26T01:00:00Z',
  transactionHash: 'hash',
  sourceAccount: 'Ga',
  from: 'Ga',
  to: 'Gb',
  amount: '1.0000000',
  asset: { kind: 'native' as const },
};
const partition = { networkId: 'testnet', accountAddress: 'Ga' };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => {
    resolve = done;
  });
  return { promise, resolve };
}
async function settle() {
  for (let i = 0; i < 120; i++) await Promise.resolve();
}
async function tick(ms: number) {
  jest.advanceTimersByTime(ms);
  await settle();
}
async function setup() {
  const runtime = createLedgerReadRuntime();
  const invalidation = createLedgerReadInvalidationStore();
  const node = createNodeReadSession({
    runtime,
    endpoint: 'https://node.test',
    networkPassphrase: 'network',
    probe: async () => 'network',
    onState: jest.fn(),
    random: () => 1,
  });
  await settle();
  const balances = jest.fn(async (address: string): Promise<StellarAccountBalanceResult> => ({
    status: 'active',
    address,
    balances: [{ kind: 'native', balance: '3.0000000' }],
    lastModifiedLedger: 50,
  }));
  const history = jest.fn(async (address: string) => ({ status: 'active' as const, address, records: [operation] }));
  const outcome = jest.fn(async (transactionHash: string): Promise<TransactionReconciliationResult> => ({
    status: 'confirmed',
    transactionHash,
    ledger: 50,
  }));
  const submitTransaction = jest.fn();
  const reads = createDisplayReadGateway({
    runtime,
    getAccountRevision: () => String(invalidation.getRevision('testnet', 'a')),
    gateway: {
      loadAccountBalances: address => node.run(() => balances(address)),
      loadAccountOperations: input => node.run(() => history(input.address)),
      loadOperation: async () => ({ status: 'not-found' }),
    },
  });
  const pending = new InMemoryPendingSubmissionRepository();
  const createPending = (id = 'a', hash = 'hash', address = 'Ga') =>
    pending.create({
      id: `testnet:${hash}`,
      networkId: 'testnet',
      accountId: id,
      sourceAddress: address,
      transactionHash: hash,
      intentKind: 'payment',
      intentKey: hash,
      state: 'uncertain',
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });
  createPending();
  const liveRecoveryGateway = {
    loadTransactionOutcome: (hash: string) => node.run(() => outcome(hash)),
    submitTransaction,
  };
  const coordinator = createTransactionReconciliationCoordinator({
    gateway: liveRecoveryGateway,
    repository: pending,
    readInvalidation: invalidation,
    networkId: 'testnet',
  });
  const balanceCache = new InMemoryBalanceCacheRepository();
  const historyCache = new InMemoryHistoryCacheRepository();
  const getAccount = jest.fn((id: string): AccountRecord | undefined => (id === 'a' ? account : undefined));
  const complete = jest.fn();
  const stop = startPostSubmitReadConvergence({
    runtime,
    node,
    invalidation,
    pending,
    coordinator,
    networkId: 'testnet',
    getAccount,
    onComplete: complete,
    balance: { gateway: reads, networkId: 'testnet', cache: balanceCache, now: () => new Date() },
    history: { gateway: reads, networkId: 'testnet', cache: historyCache, now: () => new Date() },
  });
  const emit = (id = 'a', transactionHash = 'hash') =>
    invalidation.invalidate({ networkId: 'testnet', accountId: id, transactionHash });
  const close = async () => {
    stop();
    node.close();
    await settle();
    expect(jest.getTimerCount()).toBe(0);
  };
  return {
    runtime,
    invalidation,
    node,
    balances,
    history,
    outcome,
    submitTransaction,
    pending,
    createPending,
    balanceCache,
    historyCache,
    getAccount,
    complete,
    stop,
    emit,
    close,
  };
}
beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});
describe('bounded post-submit public read convergence', () => {
  it('reuses hash-bound recovery, waits for reflected ledger and History, then caches only public DTOs without resubmitting', async () => {
    const s = await setup();
    s.outcome.mockResolvedValueOnce({ status: 'still-unknown', transactionHash: 'hash' });
    s.balances.mockResolvedValueOnce({
      status: 'active',
      address: 'Ga',
      balances: [{ kind: 'native', balance: '1.0000000' }],
      lastModifiedLedger: 40,
    });
    s.emit();
    await tick(1000);
    expect(s.pending.get('testnet', 'hash')?.state).toBe('uncertain');
    expect(s.complete).not.toHaveBeenCalled();
    await tick(2000);
    expect(s.pending.get('testnet', 'hash')).toMatchObject({ state: 'confirmed', ledger: 50 });
    expect(s.complete).toHaveBeenCalledWith('converged');
    expect(s.balances).toHaveBeenCalledTimes(2);
    expect(s.balanceCache.getSnapshot(partition)?.balance).toMatchObject({
      status: 'active',
      balances: [{ balance: '3.0000000' }],
    });
    expect(JSON.stringify(s.balanceCache.getSnapshot(partition))).not.toContain('lastModifiedLedger');
    expect(s.historyCache.getSnapshot(partition)?.entries[0].transactionHash).toBe('hash');
    await tick(60000);
    expect(s.balances).toHaveBeenCalledTimes(2);
    expect(s.submitTransaction).not.toHaveBeenCalled();
    await s.close();
  });
  it('does not declare convergence merely because the transaction is confirmed or the History record arrived first', async () => {
    const s = await setup();
    s.pending.markConfirmed('testnet', 'hash', new Date(), 50);
    s.balances.mockResolvedValueOnce({ status: 'active', address: 'Ga', balances: [], lastModifiedLedger: 40 });
    s.emit();
    await tick(1000);
    expect(s.complete).not.toHaveBeenCalled();
    expect(s.outcome).not.toHaveBeenCalled();
    await tick(2000);
    expect(s.complete).toHaveBeenCalledWith('converged');
    await s.close();
  });
  it('deduplicates repeated submission/reconciliation notifications without restarting a completed job', async () => {
    const s = await setup();
    for (let i = 0; i < 10; i++) s.emit();
    await tick(1000);
    expect(s.complete).toHaveBeenCalledTimes(1);
    expect(s.balances).toHaveBeenCalledTimes(1);
    s.emit();
    await tick(60000);
    expect(s.balances).toHaveBeenCalledTimes(1);
    await s.close();
  });
  it('bounds still-unknown recovery, preserves unresolved intent blocking and never calls broadcast', async () => {
    const s = await setup();
    s.outcome.mockResolvedValue({ status: 'still-unknown', transactionHash: 'hash' });
    s.emit();
    for (const delay of timing.delays) await tick(delay);
    expect(s.complete).toHaveBeenCalledWith('exhausted');
    expect(s.outcome).toHaveBeenCalledTimes(5);
    expect(s.pending.findBlockingIntent('testnet', 'a', 'hash')).toMatchObject({ state: 'uncertain' });
    await tick(60000);
    expect(s.outcome).toHaveBeenCalledTimes(5);
    expect(s.submitTransaction).not.toHaveBeenCalled();
    await s.close();
  });
  it('retains an absolute budget across long background pauses and cancels all scheduled work', async () => {
    const s = await setup();
    s.emit();
    s.runtime.update({ foreground: false, connectivity: 'online' });
    await tick(timing.budget + 1);
    expect(s.balances).not.toHaveBeenCalled();
    expect(s.outcome).not.toHaveBeenCalled();
    s.runtime.update({ foreground: true, connectivity: 'online' });
    await settle();
    await tick(1000);
    expect(s.complete).toHaveBeenCalledWith('exhausted');
    expect(s.balances).not.toHaveBeenCalled();
    await s.close();
  });
  it('obeys shared Retry-After during manual recovery and resumes remaining attempts only after validation', async () => {
    const s = await setup();
    s.emit();
    s.node.reportFailure(new NodeReadError('rate-limited', 20000), s.node.getSnapshot().generation);
    await tick(19000);
    expect(s.outcome).not.toHaveBeenCalled();
    await s.node.run(async () => 'cannot bypass').catch(() => undefined);
    await tick(1000);
    expect(s.node.getSnapshot().phase).toBe('healthy');
    await tick(1000);
    expect(s.complete).toHaveBeenCalledWith('converged');
    expect(s.submitTransaction).not.toHaveBeenCalled();
    await s.close();
  });
  it.each(['background', 'endpoint', 'deleted', 'hidden', 'close'] as const)(
    'does not cache an old in-flight result after %s',
    async change => {
      const s = await setup();
      s.pending.markConfirmed('testnet', 'hash', new Date(), 50);
      const response = deferred<StellarAccountBalanceResult>();
      s.balances.mockReturnValueOnce(response.promise);
      s.emit();
      await tick(1000);
      if (change === 'background') s.runtime.update({ foreground: false, connectivity: 'online' });
      if (change === 'endpoint') s.node.replaceEndpoint('https://other.test');
      if (change === 'deleted') s.getAccount.mockReturnValue(undefined);
      if (change === 'hidden') s.getAccount.mockReturnValue({ ...account, hidden: true });
      if (change === 'close') s.stop();
      response.resolve({
        status: 'active',
        address: 'Ga',
        balances: [{ kind: 'native', balance: '999.0000000' }],
        lastModifiedLedger: 50,
      });
      await settle();
      expect(s.balanceCache.getSnapshot(partition)).toBeUndefined();
      expect(s.historyCache.getSnapshot(partition)).toBeUndefined();
      await s.close();
    },
  );
  it('stops rejected outcomes through existing recovery without manufacturing a balance update', async () => {
    const s = await setup();
    s.outcome.mockResolvedValue({ status: 'rejected', transactionHash: 'hash' });
    s.emit();
    await tick(1000);
    expect(s.pending.get('testnet', 'hash')?.state).toBe('rejected');
    expect(s.complete).toHaveBeenCalledWith('rejected');
    expect(s.balances).not.toHaveBeenCalled();
    expect(s.submitTransaction).not.toHaveBeenCalled();
    await s.close();
  });
  it('ignores wrong network/source bindings and ordinary refresh events', async () => {
    const s = await setup();
    s.invalidation.refresh({ networkId: 'testnet', accountId: 'a', reason: 'manual-refresh' });
    s.invalidation.invalidate({ networkId: 'other', accountId: 'a', transactionHash: 'hash' });
    s.emit('a', 'missing-hash');
    await tick(1000);
    expect(s.balances).not.toHaveBeenCalled();
    expect(s.outcome).not.toHaveBeenCalled();
    await s.close();
  });
  it('caps the number of active jobs and clears their in-flight work on shutdown', async () => {
    const s = await setup();
    const response = deferred<StellarAccountBalanceResult>();
    s.balances.mockReturnValue(response.promise);
    s.getAccount.mockImplementation(id => ({ ...account, id, address: `G${id}` }));
    for (let i = 0; i < 20; i++) {
      const id = `account-${i}`;
      const hash = `hash-${i}`;
      s.createPending(id, hash, `G${id}`);
      s.pending.markConfirmed('testnet', hash, new Date(), 50);
      s.emit(id, hash);
    }
    await tick(1000);
    expect(s.balances).toHaveBeenCalledTimes(timing.maxJobs);
    await s.close();
  });
});
