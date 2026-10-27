export type CuratedAssetSourceId = 'lobstr' | 'soroswap' | 'stellarexpert';

export type CuratedAssetSource = Readonly<{
  id: CuratedAssetSourceId;
  name: string;
  shortName: string;
  url: string;
}>;

export type CuratedAsset = Readonly<{
  code: string;
  issuer: string;
  name?: string;
  domain?: string;
  icon?: string;
}>;

/** Public lists used by the Stellar add-asset overlay. */
export const CURATED_ASSET_SOURCES: readonly CuratedAssetSource[] = [
  {
    id: 'lobstr',
    name: 'Lobstr Curated List',
    shortName: 'Lobstr',
    url: 'https://lobstr.co/api/v1/sep/assets/curated.json',
  },
  {
    id: 'soroswap',
    name: 'Soroswap List',
    shortName: 'Soroswap',
    url: 'https://raw.githubusercontent.com/soroswap/token-list/main/tokenList.json',
  },
  {
    id: 'stellarexpert',
    name: 'StellarExpert Top 50',
    shortName: 'StellarExpert',
    url: 'https://api.stellar.expert/explorer/public/asset-list/top50',
  },
];

const ASSET_CODE = /^[A-Za-z0-9]{1,12}$/;
const ACCOUNT_ID = /^G[A-Z2-7]{55}$/;

export function isCuratedAssetCode(code: string): boolean {
  return ASSET_CODE.test(code);
}

export function isCuratedIssuer(issuer: string): boolean {
  return ACCOUNT_ID.test(issuer);
}

export function normalizeCuratedAssets(payload: unknown): readonly CuratedAsset[] {
  const unique = new Map<string, CuratedAsset>();
  for (const item of extractAssetRecords(payload)) {
    const asset = normalizeAssetRecord(item);
    if (asset) unique.set(`${asset.code}:${asset.issuer}`, asset);
  }
  return Object.freeze([...unique.values()]);
}

export function matchesCuratedAssetQuery(asset: CuratedAsset, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [asset.code, asset.name, asset.domain, asset.issuer].some(value => value?.toLowerCase().includes(needle));
}

export function parseManualAssetDocument(body: string): readonly CuratedAsset[] {
  const trimmed = body.trim();
  if (!trimmed) return [];
  try {
    return normalizeCuratedAssets(JSON.parse(trimmed) as unknown);
  } catch {
    return normalizeCuratedAssets(currenciesFromStellarToml(trimmed));
  }
}

function extractAssetRecords(payload: unknown): readonly unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  const record = payload as Record<string, unknown>;
  const records: unknown[] = [];
  if (Array.isArray(record.assets)) records.push(...record.assets);
  if (Array.isArray(record.tokens)) records.push(...record.tokens);
  if (Array.isArray(record.records)) records.push(...record.records);
  const embedded = record._embedded;
  if (embedded && typeof embedded === 'object' && Array.isArray((embedded as { records?: unknown }).records)) {
    records.push(...(embedded as { records: unknown[] }).records);
  }
  return records;
}

function normalizeAssetRecord(item: unknown): CuratedAsset | undefined {
  if (!item || typeof item !== 'object') return undefined;
  const record = item as Record<string, unknown>;
  const paired = splitAssetIdentity(text(record.asset));
  const code = text(record.code) || text(record.asset_code) || text(record.currency) || paired?.code || '';
  const issuer = text(record.issuer) || text(record.asset_issuer) || paired?.issuer || '';
  if (!isCuratedAssetCode(code) || !isCuratedIssuer(issuer)) return undefined;
  return Object.freeze({
    code,
    issuer,
    ...(text(record.name) ? { name: text(record.name) } : {}),
    ...(text(record.domain) ? { domain: text(record.domain) } : {}),
    ...(text(record.icon) || text(record.image) || text(record.avatar)
      ? { icon: text(record.icon) || text(record.image) || text(record.avatar) }
      : {}),
  });
}

function splitAssetIdentity(value: string | undefined): { code: string; issuer: string } | undefined {
  if (!value) return undefined;
  const separator = value.includes('-') ? '-' : value.includes(':') ? ':' : undefined;
  if (!separator) return undefined;
  const [code, issuer] = value.split(separator);
  if (!code || !issuer) return undefined;
  return { code, issuer };
}

function currenciesFromStellarToml(body: string): readonly Record<string, string>[] {
  const assets: Record<string, string>[] = [];
  let current: Record<string, string> | undefined;
  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '[[CURRENCIES]]') {
      if (current) assets.push(current);
      current = {};
      continue;
    }
    if (!current || !line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    const value = line
      .slice(separator + 1)
      .trim()
      .replace(/^"|"$/g, '');
    if (key === 'code' || key === 'issuer' || key === 'name' || key === 'image' || key === 'domain') {
      current[key] = value;
    }
  }
  if (current) assets.push(current);
  return assets;
}

function text(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export interface AssetCatalogPort {
  read(url: string, signal: AbortSignal): Promise<string>;
}
