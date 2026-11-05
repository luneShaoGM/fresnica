import {
  CURATED_ASSET_SOURCES,
  type AssetCatalogPort,
  type CuratedAsset,
} from '../../capabilities/trustline/curatedAssetCatalog';
import {
  TOKEN_METADATA_FAILURE_COOLDOWN_MS,
  TOKEN_METADATA_SCHEMA_VERSION,
  TOKEN_METADATA_TTL_MS,
  issuerTomlUrl,
  validTokenAsset,
  validateTokenMetadataSnapshot,
  type TokenAssetIdentity,
  type TokenDisplayMetadata,
  type TokenMetadataRepository,
  type TokenMetadataSnapshot,
} from '../../capabilities/assets/TokenMetadataCache';
import { parseManualAssetDocument } from '../../capabilities/trustline/curatedAssetCatalog';
import { safePublicHttpsUrl } from '../../capabilities/assets/safePublicHttpsUrl';
import type { SafePublicTransport } from './NativeSafePublicTransport';

export type TokenMetadataResult = Readonly<{
  metadata?: TokenDisplayMetadata;
  fromCache: boolean;
  stale: boolean;
  refreshFailed: boolean;
}>;

export interface TokenMetadataPort {
  peek(asset: TokenAssetIdentity): TokenDisplayMetadata | undefined;
  resolve(asset: TokenAssetIdentity, signal: AbortSignal, forceRefresh?: boolean): Promise<TokenMetadataResult>;
  close(): void;
}

export function createTokenMetadataPort(
  input: Readonly<{
    networkId: string;
    networkPassphrase: string;
    horizonUrl: string;
    cache: TokenMetadataRepository;
    catalog: AssetCatalogPort;
    transport: SafePublicTransport;
    now?: () => number;
  }>,
): TokenMetadataPort {
  const now = input.now ?? Date.now;
  const latest = new Map<string, number>();
  const controllers = new Set<AbortController>();
  let revision = 0;
  let closed = false;

  function read(asset: TokenAssetIdentity): TokenMetadataSnapshot | undefined {
    if (closed || !validTokenAsset(asset, input.networkId)) return;
    try {
      const value = input.cache.read(input.networkId, asset.code, asset.issuer);
      return value && validateTokenMetadataSnapshot(value, input.networkId, asset.code, asset.issuer);
    } catch {
      return;
    }
  }

  function curated(asset: TokenAssetIdentity): CuratedAsset[] {
    const rows: CuratedAsset[] = [];
    for (const source of CURATED_ASSET_SOURCES) {
      const found = input.catalog.readCachedSource?.(input.networkId, source.id);
      const match = found?.assets.find(row => row.code === asset.code && row.issuer === asset.issuer);
      if (match) rows.push(match);
    }
    return rows;
  }

  async function issuerToml(asset: TokenAssetIdentity, signal: AbortSignal): Promise<CuratedAsset | undefined> {
    const endpoint = safePublicHttpsUrl(input.horizonUrl);
    if (!endpoint) return;
    // Verify this configured endpoint is the intended network *before*
    // accepting any issuer home_domain as metadata authority.
    const root = JSON.parse(await input.transport.readText(endpoint, signal)) as Record<string, unknown>;
    if (root.network_passphrase !== input.networkPassphrase) return;
    const base = endpoint.endsWith('/') ? endpoint.slice(0, -1) : endpoint;
    const issuerUrl = safePublicHttpsUrl(`${base}/accounts/${encodeURIComponent(asset.issuer)}`);
    if (!issuerUrl) return;
    const account = JSON.parse(await input.transport.readText(issuerUrl, signal)) as Record<string, unknown>;
    if (account.account_id !== asset.issuer) return;
    const tomlUrl = issuerTomlUrl(account.home_domain);
    if (!tomlUrl) return;
    const document = await input.transport.readText(tomlUrl, signal);
    return parseManualAssetDocument(document).find(row => row.code === asset.code && row.issuer === asset.issuer);
  }

  return {
    peek(asset) {
      return read(asset)?.metadata ?? buildMetadata(curated(asset));
    },
    async resolve(asset, signal, forceRefresh = false) {
      if (closed || signal.aborted || !validTokenAsset(asset, input.networkId)) {
        throw new Error('asset-metadata-unavailable');
      }
      const previous = read(asset);
      const timestamp = now();
      if (
        !forceRefresh &&
        previous?.metadata?.source === 'issuer-toml' &&
        previous.retryAfterUnixMs === undefined &&
        previous.savedAtUnixMs <= timestamp &&
        timestamp - previous.savedAtUnixMs < TOKEN_METADATA_TTL_MS
      )
        return { metadata: previous.metadata, fromCache: true, stale: false, refreshFailed: false };
      if (!forceRefresh && (previous?.retryAfterUnixMs ?? 0) > timestamp) {
        return {
          metadata: previous?.metadata ?? buildMetadata(curated(asset)),
          fromCache: true,
          stale: true,
          refreshFailed: true,
        };
      }
      const key = JSON.stringify([input.networkId, asset.code, asset.issuer]);
      const request = ++revision;
      latest.set(key, request);
      const controller = new AbortController();
      controllers.add(controller);
      const abort = () => controller.abort();
      signal.addEventListener('abort', abort);
      if (signal.aborted) controller.abort();
      try {
        const fromCatalog = curated(asset);
        let fromToml: CuratedAsset | undefined;
        try {
          fromToml = await issuerToml(asset, controller.signal);
        } catch {
          // Invalid issuer metadata never erases valid curated data.
        }
        if (closed || signal.aborted || controller.signal.aborted || latest.get(key) !== request) {
          throw new Error('asset-metadata-cancelled');
        }
        // Curated rows are a display fallback, not evidence that issuer
        // metadata refreshed successfully. Keep the fallback while retrying
        // issuer enrichment after the 24-hour failure cooldown.
        const issuerRefreshed = fromToml !== undefined;
        const metadata = issuerRefreshed
          ? buildMetadata(fromCatalog, fromToml)
          : previous?.metadata?.source === 'issuer-toml'
            ? previous.metadata
            : buildMetadata(fromCatalog);
        const snapshot = validateTokenMetadataSnapshot(
          {
            schemaVersion: TOKEN_METADATA_SCHEMA_VERSION,
            networkId: input.networkId,
            code: asset.code,
            issuer: asset.issuer,
            savedAtUnixMs: issuerRefreshed ? Math.floor(now()) : (previous?.savedAtUnixMs ?? Math.floor(now())),
            ...(metadata ? { metadata } : {}),
            ...(issuerRefreshed ? {} : { retryAfterUnixMs: Math.floor(now()) + TOKEN_METADATA_FAILURE_COOLDOWN_MS }),
          },
          input.networkId,
          asset.code,
          asset.issuer,
        );
        if (!snapshot) throw new Error('asset-metadata-invalid');
        try {
          input.cache.replace(snapshot);
        } catch {
          /* UI metadata cache is best-effort. */
        }
        return {
          ...(metadata ? { metadata } : {}),
          fromCache: false,
          stale: !issuerRefreshed,
          refreshFailed: !issuerRefreshed,
        };
      } catch (error) {
        if (closed || signal.aborted || controller.signal.aborted || latest.get(key) !== request) throw error;
        const fallback = previous?.metadata ?? buildMetadata(curated(asset));
        const snapshot = validateTokenMetadataSnapshot(
          {
            schemaVersion: TOKEN_METADATA_SCHEMA_VERSION,
            networkId: input.networkId,
            code: asset.code,
            issuer: asset.issuer,
            savedAtUnixMs: previous?.savedAtUnixMs ?? 0,
            ...(fallback ? { metadata: fallback } : {}),
            retryAfterUnixMs: Math.floor(now()) + TOKEN_METADATA_FAILURE_COOLDOWN_MS,
          },
          input.networkId,
          asset.code,
          asset.issuer,
        );
        if (snapshot)
          try {
            input.cache.replace(snapshot);
          } catch {
            /* best-effort */
          }
        return { metadata: fallback, fromCache: !!fallback, stale: true, refreshFailed: true };
      } finally {
        signal.removeEventListener('abort', abort);
        controllers.delete(controller);
      }
    },
    close() {
      if (closed) return;
      closed = true;
      for (const controller of controllers) controller.abort();
      controllers.clear();
    },
  };
}

function buildMetadata(
  orderedCurated: readonly CuratedAsset[],
  fromToml?: CuratedAsset,
): TokenDisplayMetadata | undefined {
  if (orderedCurated.length === 0 && !fromToml) return;
  const icons: string[] = [];
  for (const row of [...orderedCurated, ...(fromToml ? [fromToml] : [])]) {
    const url = safePublicHttpsUrl(row.icon);
    if (url && !icons.includes(url) && icons.length < 8) icons.push(url);
  }
  const preferred = fromToml ?? orderedCurated[0];
  const displayName = preferred?.name?.trim();
  const displayDomain = preferred?.domain?.trim();
  return {
    source: fromToml ? 'issuer-toml' : 'curated',
    icons,
    ...(displayName && displayName.length <= 160 ? { name: displayName } : {}),
    ...(displayDomain && displayDomain.length <= 255 ? { domain: displayDomain } : {}),
  };
}
