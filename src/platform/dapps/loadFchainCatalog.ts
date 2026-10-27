import type { DappCatalogEntry, DappCatalogLoadResult, DappCatalogPort } from '../../capabilities/dapp-catalog/catalog';
import {
  DAPP_CATALOG_CACHE_VERSION,
  type DappCatalogCacheRepository,
  type DappCatalogCacheSnapshot,
} from '../../capabilities/dapp-catalog/catalogCache';
import { normalizeUntrustedDappUrl } from '../../capabilities/dapp-interaction/externalDappUrl';

const CATALOG_URL = 'https://dapp.fchain.io/v1';
const TIMEOUT_MS = 15_000;
const MAX_BODY_LENGTH = 1_000_000;
const MAX_ENTRIES = 500;

export function createFchainCatalog(dependencies: {
  cache: DappCatalogCacheRepository;
  networkId: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
}): DappCatalogPort {
  const { networkId, cache } = dependencies;
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const now = dependencies.now ?? Date.now;
  let pending: Promise<DappCatalogLoadResult> | undefined;

  return {
    load: () => {
      if (networkId !== 'stellar-mainnet' && networkId !== 'stellar-testnet')
        return Promise.resolve({ kind: 'unavailable' });
      if (pending) return pending;
      pending = refresh(cache, networkId, fetchImpl, now).finally(() => {
        pending = undefined;
      });
      return pending;
    },
  };
}

async function refresh(
  cache: DappCatalogCacheRepository,
  networkId: string,
  fetchImpl: typeof fetch,
  now: () => number,
): Promise<DappCatalogLoadResult> {
  const candidate = cache.read(networkId);
  const previous = candidate?.networkId === networkId ? candidate : undefined;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (previous?.etag) headers['If-None-Match'] = previous.etag;
  if (previous?.lastModified) headers['If-Modified-Since'] = previous.lastModified;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetchImpl(CATALOG_URL, {
      method: 'GET',
      headers,
      signal: controller.signal,
      redirect: 'error',
    });
    if (response.url && response.url !== CATALOG_URL) throw new Error('dapp-catalog-redirect');
    if (response.status === 304 && previous) return { kind: 'ready', entries: previous.entries };
    if (response.status < 200 || response.status >= 300) throw new Error('dapp-catalog-http');
    const contentLength = response.headers.get('content-length');
    if (contentLength !== null && (!/^\d+$/.test(contentLength) || Number(contentLength) > MAX_BODY_LENGTH))
      throw new Error('dapp-catalog-size');
    const body = await response.text();
    if (body.length === 0 || body.length > MAX_BODY_LENGTH) throw new Error('dapp-catalog-size');

    const entries = catalogEntriesFromFchain(JSON.parse(body), networkId);
    const snapshot: DappCatalogCacheSnapshot = {
      schemaVersion: DAPP_CATALOG_CACHE_VERSION,
      networkId,
      savedAtUnixMs: now(),
      entries,
      ...(header(response, 'etag') ? { etag: header(response, 'etag') } : {}),
      ...(header(response, 'last-modified') ? { lastModified: header(response, 'last-modified') } : {}),
    };
    cache.replace(snapshot);
    return { kind: 'ready', entries };
  } catch {
    if (previous) return { kind: 'ready', entries: previous.entries, stale: true };
    throw new Error('dapp-catalog-unavailable');
  } finally {
    clearTimeout(timeout);
  }
}

export function catalogEntriesFromFchain(value: unknown, networkId: string): readonly DappCatalogEntry[] {
  if (!isObject(value) || value.schemaVersion !== 1 || !Array.isArray(value.all))
    throw new Error('dapp-catalog-schema');
  if (networkId !== 'stellar-mainnet' && networkId !== 'stellar-testnet') return [];

  const seen = new Set<string>();
  const entries: DappCatalogEntry[] = [];
  for (const raw of value.all) {
    if (entries.length >= MAX_ENTRIES) break;
    const entry = readEntry(raw, networkId);
    if (!entry || seen.has(entry.id)) continue;
    seen.add(entry.id);
    entries.push(entry);
  }
  return Object.freeze(entries);
}

function readEntry(value: unknown, networkId: string): DappCatalogEntry | undefined {
  if (!isObject(value) || (value.stage !== 'production' && value.stage !== 'beta')) return undefined;
  if (
    !text(value.identifier, 128) ||
    !text(value.name, 128) ||
    !text(value.shortDescription, 280) ||
    !text(value.primaryCategory, 64) ||
    !isObject(value.launchUrls)
  )
    return undefined;
  const rawUrl = networkId === 'stellar-mainnet' ? value.launchUrls.mainnet : value.launchUrls.testnet;
  if (typeof rawUrl !== 'string' || !/^https:\/\//i.test(rawUrl)) return undefined;
  try {
    const destination = normalizeUntrustedDappUrl(rawUrl);
    return Object.freeze({
      id: value.identifier.trim(),
      title: value.name.trim(),
      description: value.shortDescription.trim(),
      category: value.primaryCategory.trim(),
      websiteUrl: destination.url,
    });
  } catch {
    return undefined;
  }
}

function header(response: Response, name: string): string | undefined {
  const value = response.headers.get(name)?.trim();
  return value && value.length <= 256 ? value : undefined;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}
