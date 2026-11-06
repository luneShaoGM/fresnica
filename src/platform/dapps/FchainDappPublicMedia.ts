import {
  DAPP_DETAIL_CACHE_VERSION,
  DAPP_DETAIL_RETRY_MS,
  DAPP_DETAIL_TTL_MS,
  DAPP_ICON_FAILURE_TTL_MS,
  DAPP_ICON_WINNER_TTL_MS,
  normalizeDappDetailSnapshot,
  normalizePublicDappDetail,
  validDappIdentity,
  type DappDetailCacheRepository,
  type DappDetailSnapshot,
  type PublicDappDetail,
} from '../../capabilities/dapp-catalog/dappDetails';
import type { DappCatalogEntry } from '../../capabilities/dapp-catalog/catalog';
import type { DappPublicMediaPort, PublicDappIconState } from '../../capabilities/dapp-catalog/dappPublicMedia';
import { safePublicHttpsUrl } from '../../capabilities/assets/safePublicHttpsUrl';
import { normalizeUntrustedDappUrl } from '../../capabilities/dapp-interaction/externalDappUrl';
import type { SafePublicTransport } from '../assets/NativeSafePublicTransport';

const DETAIL_BASE_URL = 'https://dapp.fchain.io/v1/dapps/';
const ICON_MEMORY_TTL_MS = 10 * 60 * 1000;

function detailFromFchain(value: unknown, networkId: string, appId: string): PublicDappDetail | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  const row = value as Record<string, unknown>;
  if (
    (row.stage !== 'production' && row.stage !== 'beta') ||
    row.identifier !== appId ||
    !row.launchUrls ||
    typeof row.launchUrls !== 'object' ||
    Array.isArray(row.launchUrls) ||
    !row.developer ||
    typeof row.developer !== 'object' ||
    Array.isArray(row.developer)
  )
    return;
  const urls = row.launchUrls as Record<string, unknown>;
  const target = networkId === 'stellar-mainnet' ? urls.mainnet : urls.testnet;
  if (typeof target !== 'string') return;
  let websiteUrl: string;
  try {
    websiteUrl = normalizeUntrustedDappUrl(target).url;
  } catch {
    return;
  }
  const developer = row.developer as Record<string, unknown>;
  const candidate = safePublicHttpsUrl(row.iconUrl);
  return normalizePublicDappDetail(
    {
      id: appId,
      title: row.name,
      description: row.shortDescription,
      category: row.primaryCategory,
      websiteUrl,
      longDescription: row.description,
      developerName: developer.name,
      ...(candidate ? { iconUrl: candidate } : {}),
    },
    networkId,
    appId,
  );
}

export function createFchainDappPublicMedia(
  input: Readonly<{
    networkId: string;
    cache: DappDetailCacheRepository;
    transport: SafePublicTransport;
    now?: () => number;
  }>,
): DappPublicMediaPort {
  const now = input.now ?? Date.now;
  const available =
    input.transport.available && (input.networkId === 'stellar-mainnet' || input.networkId === 'stellar-testnet');
  const listeners = new Set<() => void>();
  const detailRequests = new Map<string, number>();
  const detailControllers = new Set<AbortController>();
  const iconControllers = new Set<AbortController>();
  const images = new Map<string, { uri: string; expiresAt: number }>();
  let state: PublicDappIconState = Object.freeze({ enabled: false, revision: 0 });
  let revision = 0;
  let closed = false;

  function cached(appId: string): DappDetailSnapshot | undefined {
    if (!validDappIdentity(input.networkId, appId) || closed) return;
    try {
      const candidate = input.cache.read(input.networkId, appId);
      return candidate && normalizeDappDetailSnapshot(candidate, input.networkId, appId);
    } catch {
      return;
    }
  }

  function write(
    appId: string,
    update: (
      latest: DappDetailSnapshot | undefined,
    ) => Omit<DappDetailSnapshot, 'schemaVersion' | 'networkId' | 'appId'>,
  ) {
    if (closed) return;
    // A detail request and an icon request may finish in either order.
    // Read and merge at publication, without an await between read and
    // synchronous replace, so each writer preserves the other's fields.
    const fields = update(cached(appId));
    const normalized = normalizeDappDetailSnapshot(
      {
        schemaVersion: DAPP_DETAIL_CACHE_VERSION,
        networkId: input.networkId,
        appId,
        ...fields,
      },
      input.networkId,
      appId,
    );
    if (normalized) {
      try {
        input.cache.replace(normalized);
      } catch {
        // Display caches must never block the catalog or signing pipeline.
      }
    }
  }

  function notify(enabled = state.enabled) {
    state = Object.freeze({ enabled, revision: state.revision + 1 });
    for (const listener of listeners) listener();
  }

  function validEntry(entry: DappCatalogEntry): boolean {
    return (
      validDappIdentity(input.networkId, entry.id) &&
      Boolean(safePublicHttpsUrl(entry.iconUrl) || safePublicHttpsUrl(cached(entry.id)?.detail?.iconUrl))
    );
  }

  return {
    available,
    readCachedDetail(appId) {
      const snapshot = cached(appId);
      return snapshot?.detail
        ? { detail: snapshot.detail, fromCache: true, stale: true, refreshFailed: false }
        : undefined;
    },
    async loadDetail(appId, signal, forceRefresh = false) {
      if (closed || signal.aborted || !validDappIdentity(input.networkId, appId))
        throw new Error('dapp-detail-unavailable');
      const previous = cached(appId);
      const timestamp = now();
      if (
        !forceRefresh &&
        previous?.detail &&
        !previous.retryAfterUnixMs &&
        previous.savedAtUnixMs <= timestamp &&
        timestamp - previous.savedAtUnixMs < DAPP_DETAIL_TTL_MS
      ) {
        return { detail: previous.detail, fromCache: true, stale: false, refreshFailed: false };
      }
      if (!forceRefresh && (previous?.retryAfterUnixMs ?? 0) > timestamp) {
        if (previous?.detail) return { detail: previous.detail, fromCache: true, stale: true, refreshFailed: true };
        throw new Error('dapp-detail-unavailable');
      }
      const ticket = ++revision;
      detailRequests.set(appId, ticket);
      const controller = new AbortController();
      detailControllers.add(controller);
      const abort = () => controller.abort();
      signal.addEventListener('abort', abort);
      if (signal.aborted) controller.abort();
      const isCurrent = () =>
        !closed && !signal.aborted && !controller.signal.aborted && detailRequests.get(appId) === ticket;
      try {
        if (!available) throw new Error('dapp-detail-native-transport-unavailable');
        const body = await input.transport.readText(DETAIL_BASE_URL + encodeURIComponent(appId), controller.signal);
        const detail = detailFromFchain(JSON.parse(body), input.networkId, appId);
        if (!detail) throw new Error('dapp-detail-invalid');
        if (!isCurrent()) throw new Error('dapp-detail-retired');
        write(appId, latest => ({
          savedAtUnixMs: Math.floor(now()),
          detail,
          ...(latest?.iconPreference ? { iconPreference: latest.iconPreference } : {}),
        }));
        return { detail, fromCache: false, stale: false, refreshFailed: false };
      } catch (error) {
        if (!isCurrent()) throw error;
        write(appId, latest => ({
          savedAtUnixMs: latest?.savedAtUnixMs ?? previous?.savedAtUnixMs ?? 0,
          ...((latest?.detail ?? previous?.detail) ? { detail: latest?.detail ?? previous?.detail } : {}),
          ...(latest?.iconPreference ? { iconPreference: latest.iconPreference } : {}),
          retryAfterUnixMs: Math.floor(now()) + DAPP_DETAIL_RETRY_MS,
        }));
        const fallback = cached(appId)?.detail ?? previous?.detail;
        if (fallback) return { detail: fallback, fromCache: true, stale: true, refreshFailed: true };
        throw new Error('dapp-detail-unavailable');
      } finally {
        signal.removeEventListener('abort', abort);
        detailControllers.delete(controller);
      }
    },
    getIconState: () => state,
    subscribeIcons(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setIconsEnabled(value) {
      if (closed || !available || value === state.enabled) return;
      if (!value) {
        for (const controller of iconControllers) controller.abort();
        images.clear();
      }
      notify(value);
    },
    readIcon(entry) {
      if (closed || !available || !state.enabled || !validEntry(entry)) return;
      const stored = images.get(entry.id);
      if (!stored) return;
      if (stored.expiresAt <= now()) {
        images.delete(entry.id);
        return;
      }
      return stored.uri;
    },
    async loadIcon(entry, signal) {
      if (closed || !available || !state.enabled || signal.aborted || !validEntry(entry)) return;
      const key = entry.id;
      const existing = images.get(key);
      if (existing && existing.expiresAt > now()) return existing.uri;
      const controller = new AbortController();
      iconControllers.add(controller);
      const abort = () => controller.abort();
      signal.addEventListener('abort', abort);
      if (signal.aborted) controller.abort();
      const session = state;
      const isCurrent = () =>
        !closed && state.enabled && session.enabled && !controller.signal.aborted && !signal.aborted;
      try {
        const prior = cached(key);
        const candidateUrls = Array.from(
          new Set(
            [safePublicHttpsUrl(entry.iconUrl), safePublicHttpsUrl(prior?.detail?.iconUrl)].filter(
              (candidate): candidate is string => !!candidate,
            ),
          ),
        );
        const pref = prior?.iconPreference;
        const urls =
          pref?.winner && (pref.winnerExpiresAt ?? 0) > now() && candidateUrls.includes(pref.winner)
            ? [pref.winner, ...candidateUrls.filter(item => item !== pref.winner)]
            : candidateUrls;
        const failures = { ...pref?.failures };
        for (const url of urls) {
          if (!isCurrent()) return;
          if ((failures[url] ?? 0) > now()) continue;
          try {
            const image = await input.transport.readIcon(url, controller.signal);
            if (!isCurrent() || !image.dataUri.startsWith('data:image/')) return;
            images.delete(key);
            images.set(key, { uri: image.dataUri, expiresAt: now() + ICON_MEMORY_TTL_MS });
            while (images.size > 24) images.delete(images.keys().next().value as string);
            delete failures[url];
            if (!closed)
              write(key, latest => {
                const mergedFailures = { ...latest?.iconPreference?.failures, ...failures };
                delete mergedFailures[url];
                return {
                  savedAtUnixMs: latest?.savedAtUnixMs ?? 0,
                  ...(latest?.detail ? { detail: latest.detail } : {}),
                  ...(latest?.retryAfterUnixMs ? { retryAfterUnixMs: latest.retryAfterUnixMs } : {}),
                  iconPreference: {
                    winner: url,
                    winnerExpiresAt: now() + DAPP_ICON_WINNER_TTL_MS,
                    failures: mergedFailures,
                  },
                };
              });
            notify();
            return image.dataUri;
          } catch {
            if (!isCurrent()) return;
            failures[url] = now() + DAPP_ICON_FAILURE_TTL_MS;
          }
        }
        if (isCurrent() && urls.length > 0)
          write(key, latest => ({
            savedAtUnixMs: latest?.savedAtUnixMs ?? 0,
            ...(latest?.detail ? { detail: latest.detail } : {}),
            ...(latest?.retryAfterUnixMs ? { retryAfterUnixMs: latest.retryAfterUnixMs } : {}),
            iconPreference: {
              ...(latest?.iconPreference?.winner
                ? {
                    winner: latest.iconPreference.winner,
                    winnerExpiresAt: latest.iconPreference.winnerExpiresAt,
                  }
                : {}),
              failures: { ...latest?.iconPreference?.failures, ...failures },
            },
          }));
        return;
      } finally {
        signal.removeEventListener('abort', abort);
        iconControllers.delete(controller);
      }
    },
    close() {
      if (closed) return;
      closed = true;
      for (const controller of detailControllers) controller.abort();
      for (const controller of iconControllers) controller.abort();
      images.clear();
      listeners.clear();
      detailRequests.clear();
      input.transport.close();
    },
  };
}
