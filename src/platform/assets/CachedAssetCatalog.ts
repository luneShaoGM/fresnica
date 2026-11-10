import type {
  AssetCatalogPort,
  CuratedAssetSourceId,
  CuratedSourceLoad,
} from '../../capabilities/trustline/curatedAssetCatalog';
import {
  CURATED_CACHE_FAILURE_COOLDOWN_MS,
  CURATED_CACHE_TTL_MS,
  CURATED_CACHE_VERSION,
  curatedSourceAssetsFromPayload,
  curatedContractNamesFromPayload,
  curatedSourceFor,
  normalizeCuratedSourceSnapshot,
  type CuratedSourceCacheRepository,
} from '../../capabilities/trustline/curatedSourceCache';

export type CachedAssetCatalogPort = AssetCatalogPort &
  Readonly<{
    loadSource(
      networkId: string,
      sourceId: CuratedAssetSourceId,
      signal: AbortSignal,
      forceRefresh?: boolean,
    ): Promise<CuratedSourceLoad>;
    readCachedSource(networkId: string, sourceId: CuratedAssetSourceId): CuratedSourceLoad | undefined;
    close(): void;
  }>;

// Only the three explicitly approved Mainnet sources are cached. Manually
// supplied URLs remain uncached, and cached values never authorize a trustline.
export function createCachedAssetCatalog(dependencies: {
  networkId: string;
  http: AssetCatalogPort;
  cache: CuratedSourceCacheRepository;
  now?: () => number;
}): CachedAssetCatalogPort {
  const { networkId, http, cache } = dependencies;
  const now = dependencies.now ?? Date.now;
  const active = new Set<AbortController>();
  const failureUntil = new Map<string, number>();
  const latestRequest = new Map<string, number>();
  let nextRequest = 0;
  let closed = false;

  async function withAbort<T>(signal: AbortSignal, operation: (current: AbortSignal) => Promise<T>): Promise<T> {
    if (closed || signal.aborted) throw new Error('asset-catalog-cancelled');
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal.addEventListener('abort', abort);
    active.add(controller);
    try {
      const result = await operation(controller.signal);
      if (closed || signal.aborted || controller.signal.aborted) throw new Error('asset-catalog-cancelled');
      return result;
    } finally {
      signal.removeEventListener('abort', abort);
      active.delete(controller);
    }
  }

  return {
    readCachedSource(requestedNetwork, sourceId) {
      if (closed || requestedNetwork !== networkId || !curatedSourceFor(networkId, sourceId)) return undefined;
      try {
        const stored = cache.read(networkId, sourceId);
        const cached = stored && normalizeCuratedSourceSnapshot(stored, networkId, sourceId);
        if (!cached) return undefined;
        const timestamp = now();
        return {
          assets: cached.assets,
          ...(cached.contractNames ? { contractNames: cached.contractNames } : {}),
          fromCache: true,
          stale: cached.savedAtUnixMs > timestamp || timestamp - cached.savedAtUnixMs >= CURATED_CACHE_TTL_MS,
          refreshFailed: false,
        };
      } catch {
        return undefined;
      }
    },
    read: (url, signal) =>
      withAbort(signal, async current => {
        const body = await http.read(url, current);
        if (closed || current.aborted) throw new Error('asset-catalog-cancelled');
        return body;
      }),
    async loadSource(requestedNetwork, sourceId, signal, forceRefresh = false) {
      if (closed || signal.aborted) throw new Error('asset-catalog-cancelled');
      if (networkId !== requestedNetwork) throw new Error('asset-catalog-network-mismatch');
      const source = curatedSourceFor(networkId, sourceId);
      if (!source) throw new Error('asset-catalog-source-unavailable');
      const key = JSON.stringify([networkId, sourceId]);
      let cached;
      try {
        cached = cache.read(networkId, sourceId);
        if (cached) cached = normalizeCuratedSourceSnapshot(cached, networkId, sourceId);
      } catch {
        cached = undefined;
      }
      const timestamp = now();
      if (
        !forceRefresh &&
        cached &&
        cached.savedAtUnixMs <= timestamp &&
        timestamp - cached.savedAtUnixMs < CURATED_CACHE_TTL_MS
      ) {
        return {
          assets: cached.assets,
          ...(cached.contractNames ? { contractNames: cached.contractNames } : {}),
          fromCache: true,
          stale: false,
          refreshFailed: false,
        };
      }
      if (!forceRefresh && (failureUntil.get(key) ?? 0) > timestamp) {
        if (cached)
          return {
            assets: cached.assets,
            ...(cached.contractNames ? { contractNames: cached.contractNames } : {}),
            fromCache: true,
            stale: true,
            refreshFailed: true,
          };
        throw new Error('asset-catalog-cooldown');
      }

      const requestId = ++nextRequest;
      latestRequest.set(key, requestId);
      return withAbort(signal, async current => {
        try {
          const body = await http.read(source.url, current);
          if (closed || current.aborted || signal.aborted) throw new Error('asset-catalog-cancelled');
          const payload: unknown = JSON.parse(body);
          const assets = curatedSourceAssetsFromPayload(payload, sourceId);
          const contractNames = curatedContractNamesFromPayload(payload);
          const snapshot = normalizeCuratedSourceSnapshot(
            {
              schemaVersion: CURATED_CACHE_VERSION,
              networkId,
              sourceId,
              savedAtUnixMs: Math.floor(now()),
              assets,
              ...(contractNames.length ? { contractNames } : {}),
            },
            networkId,
            sourceId,
          );
          if (!snapshot) throw new Error('asset-catalog-invalid-snapshot');
          if (closed || current.aborted || signal.aborted) throw new Error('asset-catalog-cancelled');
          if (latestRequest.get(key) !== requestId) throw new Error('asset-catalog-superseded');
          try {
            cache.replace(snapshot);
          } catch {
            // Public display cache writes cannot turn a valid online read into failure.
          }
          failureUntil.delete(key);
          return {
            assets: snapshot.assets,
            ...(snapshot.contractNames ? { contractNames: snapshot.contractNames } : {}),
            fromCache: false,
            stale: false,
            refreshFailed: false,
          };
        } catch (error) {
          if (closed || current.aborted || signal.aborted || latestRequest.get(key) !== requestId) throw error;
          failureUntil.set(key, now() + CURATED_CACHE_FAILURE_COOLDOWN_MS);
          if (cached)
            return {
              assets: cached.assets,
              ...(cached.contractNames ? { contractNames: cached.contractNames } : {}),
              fromCache: true,
              stale: true,
              refreshFailed: true,
            };
          throw error;
        }
      });
    },
    close() {
      if (closed) return;
      closed = true;
      for (const controller of active) controller.abort();
      active.clear();
    },
  };
}
