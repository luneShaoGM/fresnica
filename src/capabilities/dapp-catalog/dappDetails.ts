import { safePublicHttpsUrl } from '../assets/safePublicHttpsUrl';
import { normalizeUntrustedDappUrl } from '../dapp-interaction/externalDappUrl';
import type { DappCatalogEntry } from './catalog';

export const DAPP_DETAIL_CACHE_VERSION = 1 as const;
export const DAPP_DETAIL_TTL_MS = 24 * 60 * 60 * 1000;
export const DAPP_DETAIL_RETRY_MS = 30 * 1000;
export const DAPP_ICON_WINNER_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const DAPP_ICON_FAILURE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_SNAPSHOT_BYTES = 8_192;

export type PublicDappDetail = DappCatalogEntry & Readonly<{ longDescription: string; developerName: string }>;

export type DappIconPreference = Readonly<{
  winner?: string;
  winnerExpiresAt?: number;
  failures: Readonly<Record<string, number>>;
}>;

export type DappDetailSnapshot = Readonly<{
  schemaVersion: typeof DAPP_DETAIL_CACHE_VERSION;
  networkId: 'stellar-mainnet' | 'stellar-testnet';
  appId: string;
  savedAtUnixMs: number;
  detail?: PublicDappDetail;
  retryAfterUnixMs?: number;
  iconPreference?: DappIconPreference;
}>;

export interface DappDetailCacheRepository {
  read(networkId: string, appId: string): DappDetailSnapshot | undefined;
  replace(snapshot: DappDetailSnapshot): void;
}

export function validDappIdentity(networkId: string, appId: string): boolean {
  return (
    (networkId === 'stellar-mainnet' || networkId === 'stellar-testnet') &&
    typeof appId === 'string' &&
    /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(appId) &&
    appId !== '.' &&
    appId !== '..'
  );
}

function text(value: unknown, max: number): value is string {
  return (
    typeof value === 'string' &&
    value.trim() === value &&
    value.length > 0 &&
    value.length <= max &&
    !Array.from(value).some(character => {
      const ordinal = character.charCodeAt(0);
      return ordinal < 32 || ordinal === 127;
    })
  );
}

function time(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export function normalizePublicDappDetail(
  value: unknown,
  networkId: string,
  appId: string,
): PublicDappDetail | undefined {
  if (!validDappIdentity(networkId, appId) || !value || typeof value !== 'object' || Array.isArray(value)) return;
  const raw = value as Record<string, unknown>;
  if (
    raw.id !== appId ||
    !text(raw.title, 128) ||
    !text(raw.description, 280) ||
    !text(raw.category, 64) ||
    !text(raw.longDescription, 2_000) ||
    !text(raw.developerName, 160)
  )
    return;
  let websiteUrl: string;
  try {
    if (!text(raw.websiteUrl, 2_048)) return;
    websiteUrl = normalizeUntrustedDappUrl(raw.websiteUrl).url;
  } catch {
    return;
  }
  let iconUrl: string | undefined;
  if (raw.iconUrl !== undefined) {
    iconUrl = safePublicHttpsUrl(raw.iconUrl);
    if (!iconUrl) return;
  }
  return Object.freeze({
    id: appId,
    title: raw.title,
    description: raw.description,
    category: raw.category,
    websiteUrl,
    ...(iconUrl ? { iconUrl } : {}),
    longDescription: raw.longDescription,
    developerName: raw.developerName,
  });
}

export function normalizeDappDetailSnapshot(
  value: unknown,
  networkId: string,
  appId: string,
): DappDetailSnapshot | undefined {
  if (!validDappIdentity(networkId, appId) || !value || typeof value !== 'object' || Array.isArray(value)) return;
  const raw = value as Record<string, unknown>;
  if (
    raw.schemaVersion !== DAPP_DETAIL_CACHE_VERSION ||
    raw.networkId !== networkId ||
    raw.appId !== appId ||
    !time(raw.savedAtUnixMs) ||
    (raw.retryAfterUnixMs !== undefined && !time(raw.retryAfterUnixMs))
  )
    return;
  let detail: PublicDappDetail | undefined;
  if (raw.detail !== undefined) {
    detail = normalizePublicDappDetail(raw.detail, networkId, appId);
    if (!detail) return;
  }
  let preference: DappIconPreference | undefined;
  if (raw.iconPreference !== undefined) {
    if (!raw.iconPreference || typeof raw.iconPreference !== 'object' || Array.isArray(raw.iconPreference)) return;
    const icon = raw.iconPreference as Record<string, unknown>;
    if (!icon.failures || typeof icon.failures !== 'object' || Array.isArray(icon.failures)) return;
    const entries = Object.entries(icon.failures);
    if (entries.length > 8) return;
    const failures: Record<string, number> = {};
    for (const [url, expiresAt] of entries) {
      const valid = safePublicHttpsUrl(url);
      if (!valid || valid !== url || !time(expiresAt)) return;
      failures[url] = expiresAt;
    }
    if (
      (icon.winner !== undefined && !safePublicHttpsUrl(icon.winner)) ||
      (icon.winnerExpiresAt !== undefined && !time(icon.winnerExpiresAt)) ||
      (icon.winner !== undefined) !== (icon.winnerExpiresAt !== undefined)
    )
      return;
    preference = Object.freeze({
      failures: Object.freeze(failures),
      ...(icon.winner !== undefined
        ? { winner: safePublicHttpsUrl(icon.winner)!, winnerExpiresAt: icon.winnerExpiresAt as number }
        : {}),
    });
  }
  if (!detail && !preference && raw.retryAfterUnixMs === undefined) return;
  const snapshot: DappDetailSnapshot = Object.freeze({
    schemaVersion: DAPP_DETAIL_CACHE_VERSION,
    networkId: networkId as DappDetailSnapshot['networkId'],
    appId,
    savedAtUnixMs: raw.savedAtUnixMs,
    ...(detail ? { detail } : {}),
    ...(raw.retryAfterUnixMs === undefined ? {} : { retryAfterUnixMs: raw.retryAfterUnixMs as number }),
    ...(preference ? { iconPreference: preference } : {}),
  });
  return JSON.stringify(snapshot).length <= MAX_SNAPSHOT_BYTES ? snapshot : undefined;
}
