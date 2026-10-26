import type {
  LedgerReadInvalidation,
  LedgerReadInvalidationPort,
} from '@capabilities/transaction/LedgerReadInvalidation';

export type LedgerReadRefresh = Readonly<{
  networkId: string;
  accountId: string;
  reason:
    | 'cold-start'
    | 'foreground'
    | 'network-recovery'
    | 'manual-refresh'
    | 'offline'
    | 'account-effects'
    | 'node-recovery'
    | 'post-submit';
}>;

export interface LedgerReadInvalidationStore extends LedgerReadInvalidationPort {
  subscribeTransactions(listener: (input: LedgerReadInvalidation) => void): () => void;
  refresh(input: LedgerReadRefresh): void;
  getRevision(networkId: string, accountId: string): number;
  subscribe(listener: () => void): () => void;
}

export function createLedgerReadInvalidationStore(): LedgerReadInvalidationStore {
  const transactionListeners = new Set<(input: LedgerReadInvalidation) => void>();
  const revisions = new Map<string, number>();
  const listeners = new Set<() => void>();

  const invalidate = (input: LedgerReadInvalidation | LedgerReadRefresh) => {
    const key = identityKey(input.networkId, input.accountId);
    revisions.set(key, (revisions.get(key) ?? 0) + 1);
    for (const listener of listeners) {
      listener();
    }
  };

  return {
    invalidate(input) {
      invalidate(input);
      transactionListeners.forEach(listener => listener(input));
    },
    subscribeTransactions(listener) {
      transactionListeners.add(listener);
      return () => {
        transactionListeners.delete(listener);
      };
    },
    refresh: invalidate,
    getRevision(networkId, accountId) {
      return revisions.get(identityKey(networkId, accountId)) ?? 0;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

function identityKey(networkId: string, accountId: string): string {
  return JSON.stringify([networkId, accountId]);
}
