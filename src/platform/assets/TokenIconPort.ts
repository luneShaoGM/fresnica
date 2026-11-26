import { validTokenAsset, type TokenAssetIdentity } from '../../capabilities/assets/TokenMetadataCache';
import type { TokenIconPort, TokenIconState } from '../../capabilities/assets/TokenIcons';
import { CURATED_ASSET_SOURCES, type AssetCatalogPort } from '../../capabilities/trustline/curatedAssetCatalog';
import { publicAssetFailure, type PublicAssetFailure, type SafePublicTransport } from './NativeSafePublicTransport';
import type { CachedTokenIcon, TokenIconDiskCache } from './NativeTokenIconCache';
import type { TokenMetadataPort } from './TokenMetadataResolver';

export const TOKEN_ICON_FRESHNESS_MS = 7 * 24 * 60 * 60 * 1000;
const FAILED_CANDIDATE_TTL_MS = 60 * 60 * 1000;
const TRANSIENT_FAILURE_TTL_MS = 30 * 1000;
const MAX_CONCURRENT_ICON_LOADS = 2;
type IconDiagnostic = 'cache-hit' | 'downloaded' | `download-${PublicAssetFailure}`;

// Public display bytes have no account/signing authority. Only mounted asset
// consumers start loads; privacy OFF revokes memory and native cache leases.
export function createTokenIconPort(
  input: Readonly<{
    networkId: string;
    metadata: TokenMetadataPort;
    catalog?: AssetCatalogPort;
    transport: SafePublicTransport;
    diskCache?: TokenIconDiskCache;
    initialEnabled?: boolean;
    now?: () => number;
    onDiagnostic?: (event: IconDiagnostic) => void;
  }>,
): TokenIconPort {
  const now = input.now ?? Date.now;
  const available =
    (input.networkId === 'stellar-mainnet' || input.networkId === 'stellar-testnet') && input.transport.available;
  const listeners = new Set<() => void>();
  const images = new Map<string, CachedTokenIcon>();
  const failed = new Map<string, { until: number; kind: PublicAssetFailure }>();
  const loads = new Map<
    string,
    {
      controller: AbortController;
      promise: Promise<string | undefined>;
      consumers: number;
    }
  >();
  let state: TokenIconState = Object.freeze({
    enabled: available && input.initialEnabled === true,
    revision: 0,
    retryRevision: 0,
  });
  let consent = input.initialEnabled === true;
  let closed = false;
  let readable = true;
  let catalogRefresh: Promise<void> | undefined;
  let catalogController: AbortController | undefined;
  let activeIconLoads = 0;
  const waitingIconLoads: Array<() => void> = [];
  // An unsupported network/older bridge is not a user privacy opt-out.
  input.diskCache?.setEnabled(consent);

  const keyFor = (asset: TokenAssetIdentity) => JSON.stringify([input.networkId, asset.code, asset.issuer]);
  const fresh = (image: CachedTokenIcon | undefined) =>
    image !== undefined && image.savedAtUnixMs <= now() && now() - image.savedAtUnixMs < TOKEN_ICON_FRESHNESS_MS;
  const emit = (enabled = state.enabled, retry = false) => {
    state = Object.freeze({
      enabled,
      revision: state.revision + 1,
      retryRevision: state.retryRevision + Number(retry),
    });
    for (const listener of listeners) listener();
  };
  function remember(key: string, image: CachedTokenIcon): void {
    images.delete(key);
    images.set(key, image);
    while (images.size > 24) images.delete(images.keys().next().value!);
    emit();
  }
  function markFailed(url: string, kind: PublicAssetFailure): void {
    if (kind === 'cancelled') return;
    failed.delete(url);
    failed.set(url, {
      kind,
      until: now() + (kind === 'transient' ? TRANSIENT_FAILURE_TTL_MS : FAILED_CANDIDATE_TTL_MS),
    });
    while (failed.size > 120) failed.delete(failed.keys().next().value!);
  }
  function cancelCatalog(): void {
    catalogController?.abort();
    catalogController = undefined;
    catalogRefresh = undefined;
  }
  function cancelLoads(): void {
    cancelCatalog();
    for (const load of [...loads.values()]) load.controller.abort();
    loads.clear();
  }

  // Bound whole online operations so a list mount cannot exhaust the native
  // queue and turn local backpressure into an issuer-metadata failure.
  function releaseIconSlot(): void {
    activeIconLoads -= 1;
    while (activeIconLoads < MAX_CONCURRENT_ICON_LOADS && waitingIconLoads.length > 0) {
      waitingIconLoads.shift()?.();
    }
  }
  function acquireIconSlot(signal: AbortSignal): Promise<boolean> {
    return new Promise(resolve => {
      if (closed || !state.enabled || !readable || signal.aborted) {
        resolve(false);
        return;
      }
      const start = () => {
        signal.removeEventListener('abort', onAbort);
        if (closed || !state.enabled || !readable || signal.aborted) {
          resolve(false);
          return;
        }
        activeIconLoads += 1;
        resolve(true);
      };
      const onAbort = () => {
        const index = waitingIconLoads.indexOf(start);
        if (index < 0) return;
        waitingIconLoads.splice(index, 1);
        signal.removeEventListener('abort', onAbort);
        resolve(false);
      };
      if (activeIconLoads < MAX_CONCURRENT_ICON_LOADS && waitingIconLoads.length === 0) start();
      else {
        waitingIconLoads.push(start);
        signal.addEventListener('abort', onAbort);
        if (signal.aborted) onAbort();
      }
    });
  }

  // Only an in-flight directory read is shared; CachedAssetCatalog owns the
  // 12-hour successful TTL and short session failure cooldown. Never poll.
  function refreshCuratedCatalog(): Promise<void> {
    if (input.networkId !== 'stellar-mainnet' || !input.catalog?.loadSource) return Promise.resolve();
    if (!catalogRefresh) {
      catalogController = new AbortController();
      const signal = catalogController.signal;
      const loader = input.catalog.loadSource;
      const current = Promise.allSettled(
        CURATED_ASSET_SOURCES.map(source => loader(input.networkId, source.id, signal)),
      ).then(() => {
        if (catalogRefresh === current) {
          catalogRefresh = undefined;
          catalogController = undefined;
        }
      });
      catalogRefresh = current;
    }
    return catalogRefresh;
  }

  async function loadIcon(asset: TokenAssetIdentity, signal: AbortSignal): Promise<string | undefined> {
    const key = keyFor(asset);
    const usable = () => !closed && state.enabled && !signal.aborted;
    const online = () => usable() && readable;
    let acquired = false;
    try {
      // Disk hydration is independent of connectivity and never waits behind
      // slow network requests. Freshness is separate from display validity.
      if (!images.has(key)) {
        const stored = await input.diskCache?.read(key).catch(() => undefined);
        if (!usable()) return;
        if (stored) {
          remember(key, stored);
          input.onDiagnostic?.('cache-hit');
        }
      }
      if (!usable()) return;
      if (fresh(images.get(key)) || !readable) return images.get(key)?.dataUri;
      acquired = await acquireIconSlot(signal);
      if (!acquired || !online()) return;
      if (fresh(images.get(key))) return images.get(key)?.dataUri;
      const attempted = new Set<string>();
      async function tryCandidates(candidates: readonly string[]): Promise<string | undefined> {
        for (const url of candidates) {
          if (!online()) return;
          if (attempted.has(url)) continue;
          attempted.add(url);
          if ((failed.get(url)?.until ?? 0) > now()) continue;
          try {
            const result = await input.transport.readIcon(url, signal);
            if (!online()) return;
            failed.delete(url);
            remember(key, { ...result, sourceUrl: url, savedAtUnixMs: Math.floor(now()) });
            input.onDiagnostic?.('downloaded');
            // Publication precedes best-effort disk IO and optional enrichment.
            // Native lease revocation prevents a late write after privacy OFF.
            await input.diskCache?.write(key, url, result).catch(() => undefined);
            return result.dataUri;
          } catch (error) {
            if (!online()) return;
            const kind = publicAssetFailure(error);
            markFailed(url, kind);
            input.onDiagnostic?.(`download-${kind}`);
          }
        }
        return;
      }
      const previous = images.get(key);
      const known = [...(previous ? [previous.sourceUrl] : []), ...(input.metadata.peek(asset)?.icons ?? [])];
      let result = await tryCandidates(known);
      if (!online()) return;
      if (!result) {
        await refreshCuratedCatalog();
        if (!online()) return;
        result = await tryCandidates(input.metadata.peek(asset)?.icons ?? []);
      }
      if (!online()) return;
      // An existing candidate already rendered above. Issuer lookup enriches
      // display metadata without delaying that image or establishing trust.
      let enriched;
      try {
        enriched = (await input.metadata.resolve(asset, signal)).metadata;
      } catch {
        if (!online()) return;
      }
      if (!online()) return;
      emit();
      if (!result) result = await tryCandidates(enriched?.icons ?? []);
      return usable() ? (result ?? images.get(key)?.dataUri) : undefined;
    } finally {
      if (acquired) releaseIconSlot();
    }
  }

  return {
    available,
    getSnapshot: () => state,
    subscribe(callback) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    setEnabled(value) {
      if (closed || value === consent) return;
      consent = value;
      if (!value) {
        cancelLoads();
        images.clear();
        failed.clear();
      }
      input.diskCache?.setEnabled(value);
      emit(available && value, value);
    },
    setReadable(value) {
      if (closed || readable === value) return;
      readable = value;
      if (!value) {
        cancelLoads();
        // NetInfo may resolve unknown -> offline during initial disk IO.
        // Mounted consumers must be able to rehydrate with networking paused.
        emit(state.enabled, true);
      } else {
        for (const [url, failure] of failed) if (failure.kind === 'transient') failed.delete(url);
        input.metadata.retryTransientFailures?.();
        input.catalog?.retryFailedSources?.();
        emit(state.enabled, true);
      }
    },
    readIcon(asset) {
      if (closed || !state.enabled || !available || !validTokenAsset(asset, input.networkId)) return;
      const key = keyFor(asset);
      const stored = images.get(key);
      if (!stored) return;
      // Touch memory LRU without extending freshness or erasing stale bytes.
      images.delete(key);
      images.set(key, stored);
      return stored.dataUri;
    },
    readDomain(asset) {
      if (closed || !state.enabled || !available || !validTokenAsset(asset, input.networkId)) return;
      try {
        return input.metadata.peek(asset)?.domain;
      } catch {
        return;
      }
    },
    rejectIcon(asset, uri) {
      if (closed || !state.enabled || !validTokenAsset(asset, input.networkId)) return;
      const key = keyFor(asset);
      const current = images.get(key);
      if (!current || current.dataUri !== uri) return;
      images.delete(key);
      markFailed(current.sourceUrl, 'invalid');
      loads.get(key)?.controller.abort();
      input.diskCache?.remove(key).catch(() => undefined);
      emit();
    },
    async loadIcon(asset, signal) {
      if (closed || !state.enabled || !available || signal.aborted || !validTokenAsset(asset, input.networkId)) return;
      const key = keyFor(asset);
      const cached = images.get(key);
      if (fresh(cached)) return cached?.dataUri;
      let load = loads.get(key);
      if (!load) {
        const controller = new AbortController();
        load = { controller, promise: loadIcon(asset, controller.signal), consumers: 0 };
        const current = load;
        loads.set(key, current);
        current.promise = current.promise.finally(() => {
          if (loads.get(key) === current) loads.delete(key);
        });
      }
      const current = load;
      current.consumers += 1;
      return new Promise<string | undefined>((resolve, reject) => {
        let settled = false;
        const finish = (value?: string, error?: unknown) => {
          if (settled) return;
          settled = true;
          signal.removeEventListener('abort', abort);
          current.controller.signal.removeEventListener('abort', abort);
          current.consumers -= 1;
          if (current.consumers === 0) {
            if (loads.get(key) === current) loads.delete(key);
            current.controller.abort();
            if (loads.size === 0) cancelCatalog();
          }
          if (error !== undefined) reject(error);
          else resolve(value);
        };
        const abort = () => finish();
        signal.addEventListener('abort', abort);
        current.controller.signal.addEventListener('abort', abort);
        current.promise.then(
          value => finish(value),
          error => finish(undefined, error),
        );
        if (signal.aborted || current.controller.signal.aborted) abort();
      });
    },
    close() {
      if (closed) return;
      closed = true;
      cancelLoads();
      input.diskCache?.close();
      input.transport.close();
      input.metadata.close();
      listeners.clear();
      images.clear();
      failed.clear();
    },
  };
}
