import type { BalanceAsset } from '../balance/types';
import { claimAvailability, parseClaimPredicate, type ClaimAvailability } from './predicate';

export type ClaimRisk = 'SAFE' | 'SUSPECT' | 'SPAM';
export type ClaimableRecord = Readonly<{
  id: string;
  asset: BalanceAsset;
  amount: string;
  sponsor: string;
  claimant: string;
  predicate: unknown;
  // Modified ledger time cannot prove the creation epoch for relative predicates.
  ledgerTime?: string;
  risk: ClaimRisk;
  riskFlags: readonly string[];
}>;

export type ClaimableSnapshot = Readonly<{
  networkId: string;
  address: string;
  savedAt: number;
  records: readonly ClaimableRecord[];
}>;
export const CLAIMABLE_TTL_MS = 60 * 60 * 1000;
export const CLAIMABLE_RETRY_MS = 30_000;
export const CLAIMABLE_MAX_ROWS = 1000;
export const CLAIMABLE_SNAPSHOT_VERSION = 1;

const amountPattern = /^(?:0|[1-9]\d{0,14})(?:\.\d{1,7})?$/;
const idPattern = /^00000000[a-fA-F0-9]{64}$/;
const creditPattern = /^([a-zA-Z0-9]{1,12}):(G[A-Z2-7]{55})$/;

export function validClaimableId(id: string): boolean {
  return idPattern.test(id);
}
export function mapClaimableRecord(raw: unknown, account: string): ClaimableRecord {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('claimable-record-invalid');
  const row = raw as Record<string, unknown>;
  const id = row.id;
  const amount = row.amount;
  const sponsor = row.sponsor;
  const assetText = row.asset;
  if (
    typeof id !== 'string' ||
    !validClaimableId(id) ||
    typeof amount !== 'string' ||
    !amountPattern.test(amount) ||
    Number(amount) <= 0 ||
    typeof sponsor !== 'string' ||
    sponsor.length > 128 ||
    typeof assetText !== 'string'
  )
    throw new Error('claimable-record-invalid');
  const asset: BalanceAsset =
    assetText === 'native'
      ? { kind: 'native', code: 'XLM' }
      : (() => {
          const match = creditPattern.exec(assetText);
          if (!match) throw new Error('claimable-asset-invalid');
          return { kind: 'credit' as const, code: match[1], issuer: match[2] };
        })();
  if (!Array.isArray(row.claimants) || row.claimants.length < 1 || row.claimants.length > 10)
    throw new Error('claimable-claimants-invalid');
  const matches = row.claimants.filter(
    claimant =>
      claimant !== null &&
      typeof claimant === 'object' &&
      !Array.isArray(claimant) &&
      (claimant as Record<string, unknown>).destination === account,
  );
  if (matches.length !== 1) throw new Error('claimable-claimant-mismatch');
  const predicate = (matches[0] as Record<string, unknown>).predicate;
  const risk: ClaimRisk = asset.kind === 'native' ? 'SAFE' : 'SUSPECT';
  const flags: string[] = asset.kind === 'native' ? [] : ['untrusted-credit-asset'];
  if (asset.kind === 'credit' && Number(amount) <= 0.01) flags.push('dust-amount');
  if (asset.kind === 'credit' && Number(amount) >= 100000) flags.push('large-untrusted-amount');
  return Object.freeze({
    id,
    amount,
    sponsor,
    asset,
    claimant: account,
    predicate: predicate ?? null,
    ...(typeof row.last_modified_time === 'string' ? { ledgerTime: row.last_modified_time } : {}),
    risk,
    riskFlags: flags,
  });
}

export function classifyClaimableSnapshot(
  records: readonly ClaimableRecord[],
  nowSeconds: number,
): readonly ClaimableRecord[] {
  const sponsorBurst = new Map<string, number>();
  for (const row of records) {
    const ledgerTime = row.ledgerTime === undefined ? NaN : Date.parse(row.ledgerTime) / 1000;
    if (row.sponsor && Number.isFinite(ledgerTime) && ledgerTime >= nowSeconds - 86400 && ledgerTime <= nowSeconds + 60)
      sponsorBurst.set(row.sponsor, (sponsorBurst.get(row.sponsor) ?? 0) + 1);
  }
  return records.map(row => {
    if (row.asset.kind === 'native') return { ...row, risk: 'SAFE' as const };
    const dust = Number(row.amount) <= 0.01;
    const large = Number(row.amount) >= 100000;
    const burst = (sponsorBurst.get(row.sponsor) ?? 0) >= 3;
    const flags = [...row.riskFlags, ...(burst ? ['sponsor-burst-24h'] : [])];
    return { ...row, risk: large || (burst && dust) ? ('SPAM' as const) : ('SUSPECT' as const), riskFlags: flags };
  });
}

export function displayedClaimable(
  item: ClaimableRecord,
  nowSeconds: number,
  options?: Readonly<{ hasTrustline?: boolean; userSpam?: boolean }>,
): Readonly<ClaimableRecord & { availability: ClaimAvailability; nextAt?: number }> {
  const availability = claimAvailability(parseClaimPredicate(item.predicate), nowSeconds);
  const risk =
    options?.userSpam === true
      ? 'SPAM'
      : options?.userSpam === false
        ? item.asset.kind === 'native' || options?.hasTrustline
          ? 'SAFE'
          : 'SUSPECT'
        : item.asset.kind === 'native' || options?.hasTrustline
          ? 'SAFE'
          : item.risk;
  return {
    ...item,
    risk,
    availability: availability.kind,
    ...(availability.nextAt === undefined ? {} : { nextAt: availability.nextAt }),
  };
}

export function parseClaimableSnapshot(
  raw: unknown,
  networkId: string,
  address: string,
): ClaimableSnapshot | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const data = raw as Record<string, unknown>;
  if (
    data.networkId !== networkId ||
    data.address !== address ||
    !Number.isSafeInteger(data.savedAt) ||
    Number(data.savedAt) < 0 ||
    !Array.isArray(data.records) ||
    data.records.length > CLAIMABLE_MAX_ROWS
  )
    return undefined;
  try {
    const records = data.records.map(value => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('claimable-cache-invalid-row');
      const row = value as Record<string, unknown>;
      if (
        row.claimant !== address ||
        !Array.isArray(row.riskFlags) ||
        row.riskFlags.length > 32 ||
        !row.riskFlags.every(flag => typeof flag === 'string' && flag.length < 100) ||
        (row.risk !== 'SAFE' && row.risk !== 'SUSPECT' && row.risk !== 'SPAM')
      )
        throw new Error('claimable-cache-record-identity');
      const asset = row.asset as Record<string, unknown>;
      if (!asset || typeof asset !== 'object') throw new Error('claimable-cache-asset');
      const canonical =
        asset.kind === 'native'
          ? 'native'
          : typeof asset.code === 'string' && typeof asset.issuer === 'string'
            ? asset.code + ':' + asset.issuer
            : '';
      const mapped = mapClaimableRecord(
        {
          ...row,
          asset: canonical,
          claimants: [{ destination: address, predicate: row.predicate }],
        },
        address,
      );
      return { ...mapped, risk: row.risk as ClaimRisk, riskFlags: row.riskFlags as string[] };
    });
    if (new Set(records.map(record => record.id)).size !== records.length) return undefined;
    return { networkId, address, savedAt: data.savedAt as number, records };
  } catch {
    return undefined;
  }
}
