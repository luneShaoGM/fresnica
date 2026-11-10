import {
  CURATED_ASSET_SOURCES,
  isCuratedAssetCode,
  isCuratedIssuer,
  normalizeCuratedAssets,
  type CuratedAsset,
  type CuratedAssetSourceId,
} from './curatedAssetCatalog';

export const CURATED_CACHE_VERSION = 1 as const;
export const CURATED_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
export const CURATED_CACHE_FAILURE_COOLDOWN_MS = 30_000;
export const CURATED_CACHE_MAX_ASSETS = 3000;
export const CURATED_CACHE_MAX_JSON_LENGTH = 900_000;

export type CuratedSourceSnapshot = Readonly<{
  schemaVersion: typeof CURATED_CACHE_VERSION;
  networkId: string;
  sourceId: CuratedAssetSourceId;
  savedAtUnixMs: number;
  assets: readonly CuratedAsset[];
}>;

export interface CuratedSourceCacheRepository {
  read(networkId: string, sourceId: CuratedAssetSourceId): CuratedSourceSnapshot | undefined;
  replace(snapshot: CuratedSourceSnapshot): void;
}

export function curatedSourceFor(networkId: string, sourceId: CuratedAssetSourceId) {
  if (networkId !== 'stellar-mainnet') return undefined;
  return CURATED_ASSET_SOURCES.find(source => source.id === sourceId);
}

// Keep the original code case and full issuer. Public metadata is display-only.
export function normalizeCuratedSourceSnapshot(
  value: unknown,
  networkId: string,
  sourceId: CuratedAssetSourceId,
): CuratedSourceSnapshot | undefined {
  if (!curatedSourceFor(networkId, sourceId) || !isRecord(value)) return undefined;
  if (
    value.schemaVersion !== CURATED_CACHE_VERSION ||
    value.networkId !== networkId ||
    value.sourceId !== sourceId ||
    !Number.isSafeInteger(value.savedAtUnixMs) ||
    (value.savedAtUnixMs as number) < 0 ||
    !Array.isArray(value.assets) ||
    value.assets.length > CURATED_CACHE_MAX_ASSETS
  )
    return undefined;

  const unique = new Set<string>();
  const assets: CuratedAsset[] = [];
  for (const raw of value.assets as unknown[]) {
    if (!isRecord(raw) || typeof raw.code !== 'string' || typeof raw.issuer !== 'string') return undefined;
    if (!isCuratedAssetCode(raw.code) || !isCuratedIssuer(raw.issuer)) return undefined;
    const key = JSON.stringify([raw.code, raw.issuer]);
    if (unique.has(key)) return undefined;
    unique.add(key);
    if (
      (raw.name !== undefined && !text(raw.name, 160)) ||
      (raw.domain !== undefined && !text(raw.domain, 255)) ||
      (raw.icon !== undefined && (!text(raw.icon, 2048) || !raw.icon.startsWith('https://')))
    )
      return undefined;
    assets.push(
      Object.freeze({
        code: raw.code,
        issuer: raw.issuer,
        ...(raw.name === undefined ? {} : { name: raw.name as string }),
        ...(raw.domain === undefined ? {} : { domain: raw.domain as string }),
        ...(raw.icon === undefined ? {} : { icon: raw.icon as string }),
      }),
    );
  }

  const snapshot: CuratedSourceSnapshot = Object.freeze({
    schemaVersion: CURATED_CACHE_VERSION,
    networkId,
    sourceId,
    savedAtUnixMs: value.savedAtUnixMs as number,
    assets: Object.freeze(assets),
  });
  return JSON.stringify(snapshot).length <= CURATED_CACHE_MAX_JSON_LENGTH ? snapshot : undefined;
}

// A structurally bad source is not an authoritative empty directory. In particular
// an invalid nonempty response must not overwrite a previous usable snapshot.
export function curatedSourceAssetsFromPayload(
  payload: unknown,
  sourceId?: CuratedAssetSourceId,
): readonly CuratedAsset[] {
  let records: readonly unknown[];
  if (Array.isArray(payload)) records = payload;
  else if (isRecord(payload)) {
    const fields = ['assets', 'tokens', 'records'];
    const arrays = fields.flatMap(field => (Array.isArray(payload[field]) ? (payload[field] as unknown[]) : []));
    const embedded = payload._embedded;
    const hasEmbeddedRecords = isRecord(embedded) && Array.isArray(embedded.records);
    const nested = hasEmbeddedRecords ? (embedded.records as unknown[]) : [];
    if (!fields.some(field => Array.isArray(payload[field])) && !hasEmbeddedRecords) {
      throw new Error('curated-source-invalid');
    }
    records = [...arrays, ...nested];
  } else throw new Error('curated-source-invalid');

  // Unlike permissive manual input parsing, a cached public source must be
  // complete: silently discarding even one malformed row would overwrite
  // last-good assets with a partial list for the entire cache TTL.
  if (
    records.some(record => !isSoroswapContractOnly(record, sourceId) && normalizeCuratedAssets([record]).length !== 1)
  ) {
    throw new Error('curated-source-invalid');
  }
  // The approved Soroswap list includes Soroban-only contracts, which are
  // *not* classic (code, issuer) trustline assets. They cannot supply a
  // credit-asset icon; keep the valid issued rows without relaxing the
  // fail-closed behavior for a malformed credit row or other sources.
  const normalized = normalizeCuratedAssets(payload);
  if (normalized.length > CURATED_CACHE_MAX_ASSETS) throw new Error('curated-source-too-large');

  return Object.freeze(
    normalized.map(asset =>
      Object.freeze({
        code: asset.code,
        issuer: asset.issuer,
        ...(text(asset.name, 160) ? { name: asset.name } : {}),
        ...(text(asset.domain, 255) ? { domain: asset.domain } : {}),
        ...(text(asset.icon, 2048) && asset.icon?.startsWith('https://') ? { icon: asset.icon } : {}),
      }),
    ),
  );
}

function isSoroswapContractOnly(record: unknown, sourceId: CuratedAssetSourceId | undefined): boolean {
  return (
    sourceId === 'soroswap' &&
    isRecord(record) &&
    typeof record.code === 'string' &&
    isCuratedAssetCode(record.code) &&
    typeof record.contract === 'string' &&
    /^C[A-Z2-7]{55}$/.test(record.contract) &&
    record.issuer === undefined &&
    record.asset_issuer === undefined &&
    record.asset === undefined
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength && value.trim() === value;
}
