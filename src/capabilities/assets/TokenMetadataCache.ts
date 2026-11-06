import { isCuratedAssetCode, isCuratedIssuer } from '../trustline/curatedAssetCatalog';
import { safePublicHttpsUrl } from './safePublicHttpsUrl';

export const TOKEN_METADATA_SCHEMA_VERSION = 1 as const;
export const TOKEN_METADATA_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const TOKEN_METADATA_FAILURE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export type TokenAssetIdentity = Readonly<{ kind: 'credit'; code: string; issuer: string }>;
export type TokenDisplayMetadata = Readonly<{
  name?: string;
  domain?: string;
  icons: readonly string[];
  source: 'issuer-toml' | 'curated';
}>;

export type TokenMetadataSnapshot = Readonly<{
  schemaVersion: typeof TOKEN_METADATA_SCHEMA_VERSION;
  networkId: 'stellar-mainnet' | 'stellar-testnet';
  code: string;
  issuer: string;
  savedAtUnixMs: number;
  retryAfterUnixMs?: number;
  metadata?: TokenDisplayMetadata;
}>;

export interface TokenMetadataRepository {
  read(networkId: string, code: string, issuer: string): TokenMetadataSnapshot | undefined;
  replace(snapshot: TokenMetadataSnapshot): void;
}

export function validTokenAsset(asset: TokenAssetIdentity, networkId: string): boolean {
  return (
    (networkId === 'stellar-mainnet' || networkId === 'stellar-testnet') &&
    asset.kind === 'credit' &&
    isCuratedAssetCode(asset.code) &&
    isCuratedIssuer(asset.issuer)
  );
}

export function validateTokenMetadataSnapshot(
  value: unknown,
  networkId: string,
  code: string,
  issuer: string,
): TokenMetadataSnapshot | undefined {
  if (
    (networkId !== 'stellar-mainnet' && networkId !== 'stellar-testnet') ||
    !isCuratedAssetCode(code) ||
    !isCuratedIssuer(issuer) ||
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  )
    return;
  const raw = value as Record<string, unknown>;
  if (
    raw.schemaVersion !== TOKEN_METADATA_SCHEMA_VERSION ||
    raw.networkId !== networkId ||
    raw.code !== code ||
    raw.issuer !== issuer ||
    !Number.isSafeInteger(raw.savedAtUnixMs) ||
    (raw.savedAtUnixMs as number) < 0 ||
    (raw.retryAfterUnixMs !== undefined &&
      (!Number.isSafeInteger(raw.retryAfterUnixMs) || (raw.retryAfterUnixMs as number) < 0))
  )
    return;

  let metadata: TokenDisplayMetadata | undefined;
  if (raw.metadata !== undefined) {
    if (!raw.metadata || typeof raw.metadata !== 'object' || Array.isArray(raw.metadata)) return;
    const display = raw.metadata as Record<string, unknown>;
    if (
      (display.source !== 'issuer-toml' && display.source !== 'curated') ||
      !Array.isArray(display.icons) ||
      display.icons.length > 8 ||
      (display.name !== undefined && !safeText(display.name, 160)) ||
      (display.domain !== undefined && !safeText(display.domain, 255))
    )
      return;
    const icons: string[] = [];
    for (const candidate of display.icons) {
      const valid = safePublicHttpsUrl(candidate);
      if (!valid || icons.includes(valid)) return;
      icons.push(valid);
    }
    metadata = Object.freeze({
      source: display.source,
      icons: Object.freeze(icons),
      ...(display.name === undefined ? {} : { name: display.name as string }),
      ...(display.domain === undefined ? {} : { domain: display.domain as string }),
    });
  }

  if (!metadata && raw.retryAfterUnixMs === undefined) return;
  const snapshot: TokenMetadataSnapshot = Object.freeze({
    schemaVersion: TOKEN_METADATA_SCHEMA_VERSION,
    networkId: networkId as 'stellar-mainnet' | 'stellar-testnet',
    code,
    issuer,
    savedAtUnixMs: raw.savedAtUnixMs as number,
    ...(raw.retryAfterUnixMs === undefined ? {} : { retryAfterUnixMs: raw.retryAfterUnixMs as number }),
    ...(metadata ? { metadata } : {}),
  });
  return JSON.stringify(snapshot).length <= 8_192 ? snapshot : undefined;
}

function safeText(value: unknown, limit: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= limit && value.trim() === value;
}

// Require a verified issuer home_domain, never use a random registry's
// domain as authority for automatic TOML retrieval.
export function issuerTomlUrl(homeDomain: unknown): string | undefined {
  if (typeof homeDomain !== 'string' || !/^[a-zA-Z0-9.-]{4,253}$/.test(homeDomain)) return;
  return safePublicHttpsUrl(`https://${homeDomain.toLowerCase()}/.well-known/stellar.toml`);
}
