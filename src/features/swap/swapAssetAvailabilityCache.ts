import type { PathPaymentSourceAvailability } from '../../capabilities/path-payment/sourceAvailability';

export type SwapAssetAvailabilitySnapshot = Readonly<{
  options: readonly PathPaymentSourceAvailability[];
  baseFeeStroops: number;
}>;

export type SwapAssetAvailabilityCache = Readonly<{
  get: (networkId: string, accountId: string) => SwapAssetAvailabilitySnapshot | undefined;
  set: (networkId: string, accountId: string, snapshot: SwapAssetAvailabilitySnapshot) => void;
  remove: (networkId: string, accountId: string) => void;
}>;

function cacheKey(networkId: string, accountId: string): string {
  return `${networkId}:${accountId}`;
}

export function createSwapAssetAvailabilityCache(): SwapAssetAvailabilityCache {
  const entries = new Map<string, SwapAssetAvailabilitySnapshot>();
  return Object.freeze({
    get: (networkId, accountId) => entries.get(cacheKey(networkId, accountId)),
    set: (networkId, accountId, snapshot) => {
      entries.set(
        cacheKey(networkId, accountId),
        Object.freeze({
          options: Object.freeze([...snapshot.options]),
          baseFeeStroops: snapshot.baseFeeStroops,
        }),
      );
    },
    remove: (networkId, accountId) => {
      entries.delete(cacheKey(networkId, accountId));
    },
  });
}
