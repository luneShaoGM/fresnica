import type { HistoryOperationLookupResult } from '@capabilities/history/HistoryGateway';
import { loadHistoryOperationDetails } from '@capabilities/history/loadHistoryOperationDetails';

import { createDisplayReadGateway } from '../createDisplayReadGateway';
import { createLedgerReadRuntime } from '../LedgerReadRuntime';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => {
    resolve = done;
  });
  return { promise, resolve };
}
function setup() {
  const runtime = createLedgerReadRuntime();
  const revisions = new Map<string, string>();
  const gateway = {
    loadAccountBalances: jest.fn(async (address: string) => ({ status: 'inactive' as const, address })),
    loadAccountOperations: jest.fn(async (input: { address: string }) => ({
      status: 'inactive' as const,
      address: input.address,
    })),
    loadOperation: jest.fn(async (): Promise<HistoryOperationLookupResult> => ({ status: 'not-found' })),
  };
  const reads = createDisplayReadGateway({
    gateway,
    runtime,
    getAccountRevision: address => revisions.get(address) ?? '0',
  });
  return { gateway, runtime, revisions, reads };
}

describe('display read gateway', () => {
  it('coalesces concurrent identical reads without caching completed results', async () => {
    const current = setup();
    const first = current.reads.loadAccountBalances('GA');
    expect(current.reads.loadAccountBalances('GA')).toBe(first);
    await first;
    await current.reads.loadAccountBalances('GA');
    expect(current.gateway.loadAccountBalances).toHaveBeenCalledTimes(2);
  });

  it('reports only current-generation/current-revision activity for the requested account', async () => {
    const current = setup();
    const response = deferred<{ status: 'inactive'; address: string }>();
    current.gateway.loadAccountBalances.mockReturnValueOnce(response.promise);
    const old = current.reads.loadAccountBalances('GA');
    const rejected = old.catch((error: unknown) => error);
    await Promise.resolve();
    expect(current.reads.hasPendingReads('GA')).toBe(true);
    expect(current.reads.hasPendingReads('GB')).toBe(false);
    current.revisions.set('GA', '1');
    expect(current.reads.hasPendingReads('GA')).toBe(false);
    const next = current.reads.loadAccountBalances('GA');
    expect(current.reads.hasPendingReads('GA')).toBe(true);
    current.runtime.update({ foreground: false, connectivity: 'unknown' });
    expect(current.reads.hasPendingReads('GA')).toBe(false);
    await expect(next).rejects.toThrow('ledger-read-superseded');
    response.resolve({ status: 'inactive', address: 'GA' });
    expect(await rejected).toEqual(new Error('ledger-read-superseded'));
  });

  it('isolates accounts, list parameters, and operation details', async () => {
    const current = setup();
    await Promise.all([
      current.reads.loadAccountBalances('GA'),
      current.reads.loadAccountBalances('GB'),
      current.reads.loadAccountOperations({ address: 'GA', limit: 20 }),
      current.reads.loadAccountOperations({ address: 'GA', limit: 20, cursor: 'older' }),
      current.reads.loadAccountOperations({ address: 'GA', limit: 40 }),
      current.reads.loadOperation({ operationId: 'one', accountAddress: 'GA' }),
      current.reads.loadOperation({ operationId: 'two', accountAddress: 'GA' }),
    ]);
    expect(current.gateway.loadAccountBalances).toHaveBeenCalledTimes(2);
    expect(current.gateway.loadAccountOperations).toHaveBeenCalledTimes(3);
    expect(current.gateway.loadOperation).toHaveBeenCalledTimes(2);
  });

  it('blocks offline/background network reads but permits unknown reachability at startup', async () => {
    const current = setup();
    await current.reads.loadAccountBalances('GA');
    current.runtime.update({ foreground: true, connectivity: 'offline' });
    await expect(current.reads.loadAccountBalances('GA')).rejects.toThrow('ledger-read-offline');
    current.runtime.update({ foreground: false, connectivity: 'online' });
    await expect(current.reads.loadOperation({ operationId: 'one', accountAddress: 'GA' })).rejects.toThrow(
      'ledger-read-paused',
    );
    expect(current.gateway.loadAccountBalances).toHaveBeenCalledTimes(1);
    expect(current.gateway.loadOperation).not.toHaveBeenCalled();
  });

  it('rejects late results across background and resume, even when final state matches', async () => {
    const current = setup();
    const response = deferred<{ status: 'inactive'; address: string }>();
    current.gateway.loadAccountBalances.mockReturnValueOnce(response.promise);
    const old = current.reads.loadAccountBalances('GA');
    await Promise.resolve();
    current.runtime.update({ foreground: false, connectivity: 'unknown' });
    current.runtime.update({ foreground: true, connectivity: 'unknown' });
    const fresh = current.reads.loadAccountBalances('GA');
    expect(fresh).not.toBe(old);
    await fresh;
    response.resolve({ status: 'inactive', address: 'GA' });
    await expect(old).rejects.toThrow('ledger-read-superseded');
  });

  it('starts a new read after invalidation and rejects the response from the older revision', async () => {
    const current = setup();
    const response = deferred<{ status: 'inactive'; address: string }>();
    current.gateway.loadAccountBalances.mockReturnValueOnce(response.promise);
    const old = current.reads.loadAccountBalances('GA');
    await Promise.resolve();
    current.revisions.set('GA', '1');
    const fresh = current.reads.loadAccountBalances('GA');
    await fresh;
    response.resolve({ status: 'inactive', address: 'GA' });
    await expect(old).rejects.toThrow('ledger-read-superseded');
    expect(current.gateway.loadAccountBalances).toHaveBeenCalledTimes(2);
  });

  it('does not dispatch a queued request after its lifetime has ended', async () => {
    const current = setup();
    const queued = current.reads.loadAccountOperations({ address: 'GA', limit: 20 });
    current.runtime.update({ foreground: false, connectivity: 'unknown' });
    await expect(queued).rejects.toThrow('ledger-read-superseded');
    expect(current.gateway.loadAccountOperations).not.toHaveBeenCalled();
  });

  it('does not let an old completion remove the current coalesced request', async () => {
    const current = setup();
    const oldResponse = deferred<{ status: 'inactive'; address: string }>();
    const freshResponse = deferred<{ status: 'inactive'; address: string }>();
    current.gateway.loadAccountBalances
      .mockReturnValueOnce(oldResponse.promise)
      .mockReturnValueOnce(freshResponse.promise);
    const old = current.reads.loadAccountBalances('GA');
    await Promise.resolve();
    current.runtime.update({ foreground: false, connectivity: 'unknown' });
    current.runtime.update({ foreground: true, connectivity: 'unknown' });
    const fresh = current.reads.loadAccountBalances('GA');
    oldResponse.resolve({ status: 'inactive', address: 'GA' });
    await expect(old).rejects.toThrow('ledger-read-superseded');
    expect(current.reads.loadAccountBalances('GA')).toBe(fresh);
    freshResponse.resolve({ status: 'inactive', address: 'GA' });
    await fresh;
  });
  it('retries failures instead of sharing a rejected result forever', async () => {
    const current = setup();
    current.gateway.loadAccountBalances.mockRejectedValueOnce(new Error('network-error'));
    await expect(current.reads.loadAccountBalances('GA')).rejects.toThrow('network-error');
    await expect(current.reads.loadAccountBalances('GA')).resolves.toEqual({ status: 'inactive', address: 'GA' });
    expect(current.gateway.loadAccountBalances).toHaveBeenCalledTimes(2);
  });
  it('starts a fresh operation detail lookup after account invalidation and rejects an older not-found', async () => {
    const current = setup();
    const response = deferred<HistoryOperationLookupResult>();
    current.gateway.loadOperation.mockReturnValueOnce(response.promise).mockResolvedValueOnce({
      status: 'found',
      record: {
        id: 'one',
        pagingToken: 'one',
        type: 'future_operation',
        occurredAt: '2026-10-23T00:00:00Z',
        transactionHash: 'tx-one',
        sourceAccount: 'GA',
      },
    });
    const account = {
      id: 'account-a',
      networkId: 'stellar-testnet',
      address: 'GA',
      identityKind: 'classic' as const,
      hidden: false,
      label: 'A',
      sortOrder: 0,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    };
    const deps = { gateway: current.reads, networkId: account.networkId };
    const old = loadHistoryOperationDetails(deps, account, 'one');
    const oldOutcome = old.catch((error: unknown) => error);
    await Promise.resolve();
    current.revisions.set(account.address, '1');
    const fresh = loadHistoryOperationDetails(deps, account, 'one');
    await Promise.resolve();
    response.resolve({ status: 'not-found' });
    await expect(oldOutcome).resolves.toMatchObject({ message: 'ledger-read-superseded' });
    await expect(fresh).resolves.toMatchObject({ status: 'ready', entry: { id: 'one' } });
    expect(current.gateway.loadOperation).toHaveBeenCalledTimes(2);
  });

  it('isolates the same operation across requesting accounts and invalidates only the affected account', async () => {
    const current = setup();
    const accountA = deferred<HistoryOperationLookupResult>();
    const accountB = deferred<HistoryOperationLookupResult>();
    current.gateway.loadOperation.mockReturnValueOnce(accountA.promise).mockReturnValueOnce(accountB.promise);
    const inputA = { operationId: 'one', accountAddress: 'GA' };
    const inputB = { operationId: 'one', accountAddress: 'GB' };
    const oldA = current.reads.loadOperation(inputA);
    const pendingB = current.reads.loadOperation(inputB);
    const oldOutcome = oldA.catch((error: unknown) => error);
    await Promise.resolve();
    expect(pendingB).not.toBe(oldA);
    expect(current.reads.loadOperation(inputA)).toBe(oldA);
    current.revisions.set('GA', '1');
    const freshA = current.reads.loadOperation(inputA);
    expect(freshA).not.toBe(oldA);
    expect(current.reads.loadOperation(inputB)).toBe(pendingB);
    accountA.resolve({ status: 'not-found' });
    accountB.resolve({ status: 'not-found' });
    await expect(oldOutcome).resolves.toMatchObject({ message: 'ledger-read-superseded' });
    await expect(pendingB).resolves.toEqual({ status: 'not-found' });
    await expect(freshA).resolves.toEqual({ status: 'not-found' });
    expect(current.gateway.loadOperation).toHaveBeenCalledTimes(3);
  });
});
