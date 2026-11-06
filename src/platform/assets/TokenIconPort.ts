import { validTokenAsset, type TokenAssetIdentity } from '../../capabilities/assets/TokenMetadataCache';
import { CURATED_ASSET_SOURCES, type AssetCatalogPort } from '../../capabilities/trustline/curatedAssetCatalog';
import type { SafePublicTransport } from './NativeSafePublicTransport';
import type { TokenMetadataPort } from './TokenMetadataResolver';

import type { TokenIconPort, TokenIconState } from '../../capabilities/assets/TokenIcons';

const ICON_MEMORY_TTL_MS = 10 * 60 * 1000;
const FAILED_CANDIDATE_TTL_MS = 60 * 60 * 1000;

// No wallet account address, signer, raw image bytes or credentials are persisted.
// Explicit public-media consent is scoped to one network AppServices session.
export function createTokenIconPort(
  input: Readonly<{
    networkId: string;
    metadata: TokenMetadataPort;
    catalog?: AssetCatalogPort;
    transport: SafePublicTransport;
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
  let state: TokenIconState = Object.freeze({ enabled: false, revision: 0 });
  let closed = false;
  let catalogRefresh: Promise<void> | undefined;
  let catalogController: AbortController | undefined;

  // Curated Mainnet directories are fetched once per opt-in session, even if
  // Home mounts many assets concurrently. Testnet uses verified issuer TOML
  // only: no Mainnet issuer/logo candidate can cross the network boundary.
  function refreshCuratedCatalog(): Promise<void> {
    if (input.networkId !== 'stellar-mainnet' || !input.catalog?.loadSource) return Promise.resolve();
    if (!catalogRefresh) {
      catalogController = new AbortController();
      const signal = catalogController.signal;
      const loader = input.catalog.loadSource;
      catalogRefresh = Promise.allSettled(
        CURATED_ASSET_SOURCES.map(source => loader(input.networkId, source.id, signal)),
      ).then(() => undefined);
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
      try {
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
