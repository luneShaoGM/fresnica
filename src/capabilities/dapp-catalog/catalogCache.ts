import { normalizeUntrustedDappUrl } from '../dapp-interaction/externalDappUrl';
import type { DappCatalogEntry } from './catalog';

// Public catalog metadata only. This cache is never a permission or origin attestation.
export const DAPP_CATALOG_CACHE_VERSION = 1 as const;
const MAX_ENTRIES = 500;

export type DappCatalogCacheSnapshot = Readonly<{
  schemaVersion: typeof DAPP_CATALOG_CACHE_VERSION;
  networkId: string;
  savedAtUnixMs: number;
  entries: readonly DappCatalogEntry[];
  etag?: string;
  lastModified?: string;
}>;

export type DappCatalogCacheRepository = Readonly<{
  read: (networkId: string) => DappCatalogCacheSnapshot | undefined;
  replace: (snapshot: DappCatalogCacheSnapshot) => void;
}>;

export function normalizeDappCatalogCache(value: unknown, networkId: string): DappCatalogCacheSnapshot | undefined {
  if (!isObject(value) || value.schemaVersion !== DAPP_CATALOG_CACHE_VERSION) return undefined;
  if (value.networkId !== networkId || !isText(networkId, 64)) return undefined;
  if (
    typeof value.savedAtUnixMs !== 'number' ||
    !Number.isFinite(value.savedAtUnixMs) ||
    value.savedAtUnixMs <= 0 ||
    !Array.isArray(value.entries) ||
    value.entries.length > MAX_ENTRIES
  ) {
    return undefined;
  }

  const entries: DappCatalogEntry[] = [];
  const ids = new Set<string>();
  for (const candidate of value.entries) {
    if (!isObject(candidate)) return undefined;
    const { id, title, description, category, websiteUrl } = candidate;
    if (
      !isText(id, 128) ||
      !isText(title, 128) ||
      !isText(description, 280) ||
      !isText(category, 64) ||
      !isText(websiteUrl, 2048) ||
      !/^https:\/\//i.test(websiteUrl) ||
      ids.has(id)
    ) {
      return undefined;
    }
    let normalizedUrl: string;
    try {
      normalizedUrl = normalizeUntrustedDappUrl(websiteUrl).url;
    } catch {
      return undefined;
    }
    ids.add(id);
    entries.push(Object.freeze({ id, title, description, category, websiteUrl: normalizedUrl }));
  }

  return Object.freeze({
    schemaVersion: DAPP_CATALOG_CACHE_VERSION,
    networkId,
    savedAtUnixMs: value.savedAtUnixMs,
    entries: Object.freeze(entries),
    ...(isText(value.etag, 256) ? { etag: value.etag } : {}),
    ...(isText(value.lastModified, 128) ? { lastModified: value.lastModified } : {}),
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isText(value: unknown, limit: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= limit;
}
