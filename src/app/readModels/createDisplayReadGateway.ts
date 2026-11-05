import type { BalanceGatewayPort } from '@capabilities/balance/BalanceGateway';
import type { HistoryGatewayPort } from '@capabilities/history/HistoryGateway';

import type { LedgerReadRuntime } from './LedgerReadRuntime';

// Only display reads use this gate; authorization and submission keep their live gateway.
export function createDisplayReadGateway(
  dependencies: Readonly<{
    gateway: BalanceGatewayPort & HistoryGatewayPort;
    runtime: LedgerReadRuntime;
    getAccountRevision: (address: string) => string;
  }>,
): BalanceGatewayPort & HistoryGatewayPort & { hasPendingReads: (address: string) => boolean } {
  let effectsReadId = 0;
  const inFlight = new Map<
    string,
    Readonly<{
      snapshot: ReturnType<LedgerReadRuntime['getSnapshot']>;
      revision: string;
      address: string;
      request: Promise<unknown>;
    }>
  >();

  function read<T>(key: readonly unknown[], address: string, load: () => Promise<T>): Promise<T> {
    const snapshot = dependencies.runtime.getSnapshot();
    if (!snapshot.foreground || snapshot.connectivity === 'offline') {
      return Promise.reject(new Error(snapshot.foreground ? 'ledger-read-offline' : 'ledger-read-paused'));
    }
    const revision = dependencies.getAccountRevision(address);
    const requestKey = JSON.stringify(key);
    const existing = inFlight.get(requestKey);
    if (existing?.snapshot === snapshot && existing.revision === revision) return existing.request as Promise<T>;

    const request = Promise.resolve()
      .then(() => {
        assertCurrent();
        return load();
      })
      .then(result => {
        assertCurrent();
        return result;
      })
      .finally(() => {
        if (inFlight.get(requestKey)?.request === request) inFlight.delete(requestKey);
      });
    inFlight.set(requestKey, { snapshot, revision, address, request });
    return request;

    function assertCurrent() {
      if (dependencies.runtime.getSnapshot() !== snapshot || dependencies.getAccountRevision(address) !== revision) {
        throw new Error('ledger-read-superseded');
      }
    }
  }

  return {
    captureHistoryReadLease: address => {
      const snapshot = dependencies.runtime.getSnapshot();
      const revision = dependencies.getAccountRevision(address);
      if (!snapshot.foreground || snapshot.connectivity === 'offline') {
        throw new Error(snapshot.foreground ? 'ledger-read-offline' : 'ledger-read-paused');
      }
      return () => {
        if (dependencies.runtime.getSnapshot() !== snapshot || dependencies.getAccountRevision(address) !== revision) {
          throw new Error('ledger-read-superseded');
        }
      };
    },
    hasPendingReads: address => {
      const snapshot = dependencies.runtime.getSnapshot();
      const revision = dependencies.getAccountRevision(address);
      return [...inFlight.values()].some(
        entry => entry.address === address && entry.snapshot === snapshot && entry.revision === revision,
      );
    },
    loadAccountBalances: address =>
      read(['balance', address], address, () => dependencies.gateway.loadAccountBalances(address)),
    loadAccountOperations: input =>
      read(['history', input.address, input.cursor, input.limit], input.address, () =>
        dependencies.gateway.loadAccountOperations(input),
      ),
    ...(dependencies.gateway.loadOperationEffects ? { loadOperationEffects: (input: { operationId: string; accountAddress: string; signal?: AbortSignal }) =>
      read(['effects', input.accountAddress, input.operationId, ++effectsReadId], input.accountAddress, () => dependencies.gateway.loadOperationEffects!(input)) } : {}),
    loadOperation: input =>
      read(['operation', input.accountAddress, input.operationId], input.accountAddress, () =>
        dependencies.gateway.loadOperation(input),
      ),
  };
}
