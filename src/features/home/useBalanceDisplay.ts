import { useCallback, useEffect, useRef, useState } from 'react';
import type { AccountRecord } from '@capabilities/account/types';
import {
  cacheBalanceSnapshotBestEffort,
  readBalanceCacheBestEffort,
  type BalanceProductDependencies,
} from '@capabilities/balance/BalanceCacheHydration';
import { loadBalanceSnapshot } from '@capabilities/balance/loadBalanceSnapshot';
import { projectFeatureError } from '../featureError';
import { failBalanceRefresh, startBalanceRefresh, type BalanceDisplayState } from './balanceReadModel';

export function useBalanceDisplay(
  account: AccountRecord,
  dependencies: BalanceProductDependencies,
  active: boolean,
  invalidationRevision: number,
): {
  state: BalanceDisplayState;
  refresh: (beforeLoad?: () => Promise<unknown>) => Promise<void> | undefined;
  verifiedInactive?: boolean;
} {
  const [state, setState] = useState<BalanceDisplayState>({ kind: 'loading' });
  const version = useRef(0);
  const verifiedInactivePartition = useRef<string | undefined>(undefined);
  const enabled = useRef(active);
  const partition = JSON.stringify([dependencies.networkId, account.networkId, account.address, account.identityKind]);
  const displayedPartition = useRef(partition);

  const refresh = useCallback(
    (beforeLoad?: () => Promise<unknown>) => {
      if (!enabled.current) return;
      const request = ++version.current;
      const changed = displayedPartition.current !== partition;
      displayedPartition.current = partition;
      if (changed) verifiedInactivePartition.current = undefined;
      const cached =
        dependencies.networkId === account.networkId ? readBalanceCacheBestEffort(dependencies, account) : undefined;
      setState(current => startBalanceRefresh(changed ? { kind: 'loading' } : current, cached));
      const before = beforeLoad
        ? Promise.resolve()
            .then(beforeLoad)
            .catch(() => undefined)
        : Promise.resolve();
      return before
        .then(async () => {
          if (version.current !== request) return;
          const snapshot = await loadBalanceSnapshot(dependencies, account);
          if (version.current !== request) return;
          const updatedAt = dependencies.now();
          cacheBalanceSnapshotBestEffort(dependencies, account, snapshot, updatedAt);
          verifiedInactivePartition.current = snapshot.status === 'inactive' ? partition : undefined;
          setState({
            kind: 'ready',
            snapshot,
            stale: false,
            refreshing: false,
            refreshFailed: false,
            ...(snapshot.status === 'unsupported-account' ? {} : { lastSuccessfulUpdateAt: updatedAt }),
          });
        })
        .catch(error => {
          if (version.current !== request) return;
          const message = projectFeatureError(error, {
            fallbackMessage: 'Unable to load balances.',
            fallbackRetryable: true,
          }).message;
          setState(current => failBalanceRefresh(current, message));
        });
    },
    [account, dependencies, partition],
  );

  useEffect(() => {
    enabled.current = active;
    if (!active) return;
    refresh();
    return () => {
      enabled.current = false;
      version.current += 1;
    };
  }, [active, invalidationRevision, refresh]);

  return {
    state: displayedPartition.current === partition ? state : ({ kind: 'loading' } as BalanceDisplayState),
    verifiedInactive: verifiedInactivePartition.current === partition,
    refresh,
  };
}
