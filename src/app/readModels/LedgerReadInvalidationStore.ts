import type {
  LedgerReadInvalidation,
  LedgerReadInvalidationPort,
} from '@capabilities/transaction/LedgerReadInvalidation';

export type LedgerReadRefresh = Readonly<{
  networkId: string;
  accountId: string;
  reason: 'cold-start' | 'foreground' | 'network-recovery' | 'manual-refresh' | 'offline' | 'account-effects';
}>;

export interface LedgerReadInvalidationStore extends LedgerReadInvalidationPort {
  refresh(input: LedgerReadRefresh): void;
  getRevision(networkId: string, accountId: string): number;
  subscribe(listener: () => void): () => void;
}

export function createLedgerReadInvalidationStore(): LedgerReadInvalidationStore {
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
    invalidate,
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
