import { useEffect, useState } from 'react';
import type { AccountRecord } from '@capabilities/account/types';
import type { BalanceProductDependencies } from '@capabilities/balance/BalanceCacheHydration';
import { loadNativeBalanceBreakdown, type NativeBalanceBreakdown } from '@capabilities/balance/nativeBalanceBreakdown';

export function useNativeBalanceBreakdown(
  account: AccountRecord,
  dependencies: BalanceProductDependencies,
  active: boolean,
  invalidationRevision: number,
  snapshotRevision?: number,
): NativeBalanceBreakdown | undefined {
  const { address, networkId, identityKind } = account;
  const nativeReader = dependencies.nativeReader;
  const partition = JSON.stringify([dependencies.networkId, networkId, address, identityKind]);
  const revision = JSON.stringify([invalidationRevision, snapshotRevision ?? null]);
  const [state, setState] = useState<{
    partition: string;
    revision: string;
    reader: NonNullable<BalanceProductDependencies['nativeReader']>;
    value: NativeBalanceBreakdown;
  }>();
  useEffect(() => {
    let current = true;
    if (!active || dependencies.networkId !== networkId || identityKind !== 'classic' || !nativeReader) {
      setState(undefined);
      return () => {
        current = false;
      };
    }
    if (active && dependencies.networkId === networkId && identityKind === 'classic' && nativeReader) {
      void loadNativeBalanceBreakdown(nativeReader, { address, networkId, identityKind })
        .then(result => {
          if (current) setState({ partition, revision, reader: nativeReader, value: result });
        })
        .catch(() => {
          if (current) setState(undefined);
        });
    }
    return () => {
      current = false;
    };
  }, [
    active,
    address,
    dependencies.networkId,
    identityKind,
    invalidationRevision,
    nativeReader,
    networkId,
    partition,
    revision,
  ]);
  return active && state?.partition === partition && state.revision === revision && state.reader === nativeReader
    ? state.value
    : undefined;
}

// Read-only projection is accepted only when both independent network reads
// produced the exact same ledger balance. Never mix totals from different reads.
export function matchingNativeBalance(
  breakdown: NativeBalanceBreakdown | undefined,
  displayedBalance: string,
  stale: boolean,
): NativeBalanceBreakdown | undefined {
  if (!breakdown || stale) return undefined;
  const normalize = (value: string) => {
    if (!/^(?:0|[1-9]\d*)(?:\.\d{1,7})?$/.test(value)) return undefined;
    const [whole, decimals = ''] = value.split('.');
    return whole + '.' + decimals.padEnd(7, '0');
  };
  const left = normalize(breakdown.total);
  return left !== undefined && left === normalize(displayedBalance) ? breakdown : undefined;
}
