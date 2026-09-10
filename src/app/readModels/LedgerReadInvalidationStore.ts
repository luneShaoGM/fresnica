import type {
  LedgerReadInvalidation,
  LedgerReadInvalidationPort,
} from '@capabilities/transaction/LedgerReadInvalidation';

export interface LedgerReadInvalidationStore extends LedgerReadInvalidationPort {
  getRevision(networkId: string, accountId: string): number;
  subscribe(listener: () => void): () => void;
}

export function createLedgerReadInvalidationStore(): LedgerReadInvalidationStore {
  const revisions = new Map<string, number>();
  const listeners = new Set<() => void>();

  return {
    invalidate(input: LedgerReadInvalidation) {
      const key = identityKey(input.networkId, input.accountId);
      revisions.set(key, (revisions.get(key) ?? 0) + 1);
      for (const listener of listeners) {
        listener();
      }
    },
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
