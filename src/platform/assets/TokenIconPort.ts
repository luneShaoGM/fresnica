import { validTokenAsset, type TokenAssetIdentity } from '../../capabilities/assets/TokenMetadataCache';
import { CURATED_ASSET_SOURCES, type AssetCatalogPort } from '../../capabilities/trustline/curatedAssetCatalog';
import type { SafePublicTransport } from './NativeSafePublicTransport';
import type { TokenMetadataPort } from './TokenMetadataResolver';

import type { TokenIconPort, TokenIconState } from '../../capabilities/assets/TokenIcons';

const ICON_MEMORY_TTL_MS = 10 * 60 * 1000;
const FAILED_CANDIDATE_TTL_MS = 60 * 60 * 1000;
const MAX_CONCURRENT_ICON_LOADS = 2;

// No wallet account address, signer, raw image bytes or credentials are persisted.
// Public imagery is enabled by the user's persisted wallet-wide privacy preference.
// No image request runs without an active asset consumer. Turning it off clears session images.
export function createTokenIconPort(
  input: Readonly<{
    networkId: string;
    metadata: TokenMetadataPort;
    catalog?: AssetCatalogPort;
    transport: SafePublicTransport;
    initialEnabled?: boolean;
    now?: () => number;
  }>,
): TokenIconPort {
  const now = input.now ?? Date.now;
  const available =
    (input.networkId === 'stellar-mainnet' || input.networkId === 'stellar-testnet') && input.transport.available;
  const listeners = new Set<() => void>();
  const images = new Map<string, { uri: string; sourceUrl: string; expires: number }>();
  const failed = new Map<string, number>();
  const controllers = new Set<AbortController>();
  let state: TokenIconState = Object.freeze({ enabled: available && input.initialEnabled === true, revision: 0 });
  let closed = false;
  let catalogRefresh: Promise<void> | undefined;
  let catalogController: AbortController | undefined;
  let activeIconLoads = 0;
  const waitingIconLoads: Array<() => void> = [];

  // Metadata and image downloads share the same native transport (two active,
  // 16 queued). Bound the *whole* load to avoid turning local queue saturation
  // into a persisted 24-hour issuer failure when many assets mount together.
  function releaseIconSlot(): void {
    activeIconLoads -= 1;
    while (activeIconLoads < MAX_CONCURRENT_ICON_LOADS && waitingIconLoads.length > 0) {
      waitingIconLoads.shift()?.();
    }
  }

  function acquireIconSlot(signal: AbortSignal): Promise<boolean> {
    return new Promise(resolve => {
      if (closed || !state.enabled || signal.aborted) {
        resolve(false);
        return;
      }
      const start = () => {
        signal.removeEventListener('abort', onAbort);
        if (closed || !state.enabled || signal.aborted) {
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
      if (activeIconLoads < MAX_CONCURRENT_ICON_LOADS && waitingIconLoads.length === 0) {
        start();
      } else {
        waitingIconLoads.push(start);
        signal.addEventListener('abort', onAbort);
        if (signal.aborted) onAbort();
      }
    });
  }

  // Share only in-flight Mainnet directory loads across mounted consumers.
  // The cached catalog owns its 12-hour TTL and 30-second failure cooldown,
  // so a later consumer can retry after the network recovers. Testnet uses
  // issuer TOML only; Mainnet candidates never cross the network boundary.
  function refreshCuratedCatalog(): Promise<void> {
    if (input.networkId !== 'stellar-mainnet' || !input.catalog?.loadSource) return Promise.resolve();
    if (!catalogRefresh) {
      catalogController = new AbortController();
      const signal = catalogController.signal;
      const loader = input.catalog.loadSource;
      const current = Promise.allSettled(
        CURATED_ASSET_SOURCES.map(source => loader(input.networkId, source.id, signal)),
      ).then(() => {
        // An old aborted request must not clear a newer session's loader.
        if (catalogRefresh === current) {
          catalogRefresh = undefined;
          catalogController = undefined;
        }
      });
      catalogRefresh = current;
    }
    return catalogRefresh;
  }

  const keyFor = (asset: TokenAssetIdentity) => JSON.stringify([input.networkId, asset.code, asset.issuer]);
  const emit = (enabled = state.enabled) => {
    state = Object.freeze({ enabled, revision: state.revision + 1 });
    for (const listener of listeners) listener();
  };

  return {
    available,
    getSnapshot: () => state,
    subscribe(callback) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    setEnabled(value) {
      if (closed || !available || value === state.enabled) return;
      if (!value) {
        catalogController?.abort();
        catalogController = undefined;
        catalogRefresh = undefined;
        for (const controller of controllers) controller.abort();
        images.clear();
        failed.clear();
      }
      emit(value);
    },
    readIcon(asset) {
      if (closed || !state.enabled || !available || !validTokenAsset(asset, input.networkId)) return;
      const stored = images.get(keyFor(asset));
      if (!stored) return;
      if (stored.expires <= now()) {
        images.delete(keyFor(asset));
        return;
      }
      return stored.uri;
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
      if (!current || current.uri !== uri) return;
      images.delete(key);
      failed.set(current.sourceUrl, now() + FAILED_CANDIDATE_TTL_MS);
      if (failed.size > 120) failed.delete(failed.keys().next().value as string);
      emit();
    },
    async loadIcon(asset, signal) {
      if (closed || !state.enabled || !available || signal.aborted || !validTokenAsset(asset, input.networkId)) {
        return;
      }
      const key = keyFor(asset);
      const existing = images.get(key);
      if (existing && existing.expires > now()) return existing.uri;
      const controller = new AbortController();
      controllers.add(controller);
      const abort = () => controller.abort();
      signal.addEventListener('abort', abort);
      if (signal.aborted) controller.abort();
      let acquired = false;
      try {
        acquired = await acquireIconSlot(controller.signal);
        if (!acquired || closed || controller.signal.aborted || !state.enabled) return;
        await refreshCuratedCatalog();
        if (closed || controller.signal.aborted || !state.enabled) return;
        // Metadata cache must actually be populated and revalidated on opt-in:
        // peeking only at curated rows would bypass the 7-day metadata TTL.
        // Multiple mounted UI consumers may request the same asset. A
        // superseded or offline metadata refresh must not discard a valid
        // last-good candidate already available from the public cache.
        let metadata = input.metadata.peek(asset);
        try {
          metadata = (await input.metadata.resolve(asset, controller.signal)).metadata ?? metadata;
        } catch {
          if (closed || controller.signal.aborted) return;
        }
        if (closed || !state.enabled || controller.signal.aborted) return;
        // Subtitles must update even when metadata has no usable image.
        emit();
        for (const url of metadata?.icons ?? []) {
          if (closed || !state.enabled || controller.signal.aborted) return;
          const failedUntil = failed.get(url) ?? 0;
          if (failedUntil > now()) continue;
          try {
            const result = await input.transport.readIcon(url, controller.signal);
            if (closed || !state.enabled || controller.signal.aborted) return;
            images.delete(key);
            images.set(key, { uri: result.dataUri, sourceUrl: url, expires: now() + ICON_MEMORY_TTL_MS });
            while (images.size > 24) images.delete(images.keys().next().value as string);
            emit();
            return result.dataUri;
          } catch {
            if (controller.signal.aborted || closed) return;
            failed.set(url, now() + FAILED_CANDIDATE_TTL_MS);
            if (failed.size > 120) failed.delete(failed.keys().next().value as string);
          }
        }
        return;
      } finally {
        if (acquired) releaseIconSlot();
        signal.removeEventListener('abort', abort);
        controllers.delete(controller);
      }
    },
    close() {
      if (closed) return;
      closed = true;
      catalogController?.abort();
      catalogController = undefined;
      catalogRefresh = undefined;
      for (const controller of controllers) controller.abort();
      input.transport.close();
      input.metadata.close();
      controllers.clear();
      listeners.clear();
      images.clear();
      failed.clear();
    },
  };
}
