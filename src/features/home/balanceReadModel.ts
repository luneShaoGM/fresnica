import type { BalanceCacheSnapshot } from '@capabilities/balance/BalanceCacheRepository';
import type { BalanceSnapshot } from '@capabilities/balance/types';

export type BalanceDisplayState =
  | Readonly<{ kind: 'loading' }>
  | Readonly<{ kind: 'error'; message: string }>
  | Readonly<{
      kind: 'ready';
      snapshot: BalanceSnapshot;
      stale: boolean;
      refreshing: boolean;
      refreshFailed: boolean;
      lastSuccessfulUpdateAt?: Date;
    }>;

export function cachedBalanceState(cached: BalanceCacheSnapshot): BalanceDisplayState {
  return {
    kind: 'ready',
    snapshot: cached.balance,
    stale: true,
    refreshing: true,
    refreshFailed: false,
    lastSuccessfulUpdateAt: new Date(cached.lastSuccessfulUpdateAt),
  };
}
export function startBalanceRefresh(current: BalanceDisplayState, cached?: BalanceCacheSnapshot): BalanceDisplayState {
  if (current.kind === 'ready') return { ...current, stale: true, refreshing: true, refreshFailed: false };
  return cached ? cachedBalanceState(cached) : { kind: 'loading' };
}
export function failBalanceRefresh(current: BalanceDisplayState, message: string): BalanceDisplayState {
  return current.kind === 'ready'
    ? { ...current, stale: true, refreshing: false, refreshFailed: true }
    : { kind: 'error', message };
}
