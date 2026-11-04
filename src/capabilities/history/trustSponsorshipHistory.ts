import type { HistoryOperationRecord } from './HistoryGateway';
import { pathAsset } from './pathPaymentHistory';
import type {
  HistoryEntryBase,
  HistorySponsorshipEntry,
  HistoryTrustAuthorizationEntry,
  HistoryTrustFlagsEntry,
  HistoryTrustFlag,
} from './types';

export function isTrustSponsorshipType(type: string): boolean {
  return [
    'allow_trust',
    'set_trust_line_flags',
    'begin_sponsoring_future_reserves',
    'end_sponsoring_future_reserves',
  ].includes(type);
}
function classic(value: unknown): value is string {
  return typeof value === 'string' && /^G[A-Z2-7]{55}$/.test(value);
}
export function trustSponsorshipAssociated(record: HistoryOperationRecord, address: string): boolean {
  if (record.sourceAccount === address) return true;
  const peer =
    record.type === 'begin_sponsoring_future_reserves'
      ? record.sponsoredId
      : record.type === 'end_sponsoring_future_reserves'
        ? record.beginSponsor
        : record.type === 'allow_trust' || record.type === 'set_trust_line_flags'
          ? record.trustor
          : undefined;
  return classic(peer) && peer === address;
}
function flags(value: unknown): readonly HistoryTrustFlag[] | undefined {
  if (value === undefined) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > 3) return undefined;
  const values = [...value];
  if (
    values.some(flag => typeof flag !== 'number' || ![1, 2, 4].includes(flag)) ||
    new Set(values).size !== values.length
  )
    return undefined;
  return Object.freeze(values as HistoryTrustFlag[]);
}
export function mapTrustSponsorship(
  record: HistoryOperationRecord,
  accountAddress: string,
  base: HistoryEntryBase,
): HistoryTrustAuthorizationEntry | HistoryTrustFlagsEntry | HistorySponsorshipEntry | undefined {
  if (
    !isTrustSponsorshipType(record.type) ||
    record.successful !== true ||
    !classic(record.sourceAccount) ||
    record.sourceAccount !== base.sourceAccount ||
    !trustSponsorshipAssociated(record, accountAddress)
  )
    return undefined;
  if (record.type === 'begin_sponsoring_future_reserves' || record.type === 'end_sponsoring_future_reserves') {
    const begin = record.type === 'begin_sponsoring_future_reserves';
    const peer = begin ? record.sponsoredId : record.beginSponsor;
    if (!classic(peer) || peer === base.sourceAccount) return undefined;
    const sponsor = begin ? base.sourceAccount : peer;
    const beneficiary = begin ? peer : base.sourceAccount;
    return Object.freeze({
      ...base,
      kind: 'sponsorship',
      successful: true,
      sponsor,
      beneficiary,
      role: accountAddress === sponsor ? 'sponsor' : 'beneficiary',
    });
  }
  const asset = pathAsset(record.asset);
  if (
    !asset ||
    asset.kind !== 'credit' ||
    asset.issuer !== base.sourceAccount ||
    !classic(record.trustor) ||
    record.trustor === base.sourceAccount
  )
    return undefined;
  if (record.type === 'allow_trust') {
    if (
      record.trustee !== base.sourceAccount ||
      typeof record.authorize !== 'boolean' ||
      typeof record.authorizeToMaintainLiabilities !== 'boolean' ||
      (record.authorize && !record.authorizeToMaintainLiabilities)
    )
      return undefined;
    return Object.freeze({
      ...base,
      kind: 'trust-authorization',
      successful: true,
      asset,
      trustor: record.trustor,
      authorization: record.authorize
        ? 'authorized'
        : record.authorizeToMaintainLiabilities
          ? 'maintain-liabilities'
          : 'revoked',
    });
  }
  const setFlags = flags(record.setFlags);
  const clearFlags = flags(record.clearFlags);
  if (
    !setFlags ||
    !clearFlags ||
    setFlags.includes(4) ||
    (setFlags.includes(1) && setFlags.includes(2)) ||
    setFlags.some(flag => clearFlags.includes(flag))
  )
    return undefined;
  return Object.freeze({
    ...base,
    kind: 'trust-flags',
    successful: true,
    asset,
    trustor: record.trustor,
    setFlags,
    clearFlags,
  });
}
