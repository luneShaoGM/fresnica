import type { HistoryOperationRecord } from '../HistoryGateway';
export const trustIssuer = `G${'A'.repeat(55)}`;
export const trustor = `G${'B'.repeat(55)}`;
export const trustForeign = `G${'D'.repeat(55)}`;
export const trustSponsorshipTypes = [
  'allow_trust',
  'set_trust_line_flags',
  'begin_sponsoring_future_reserves',
  'end_sponsoring_future_reserves',
] as const;
export function trustSponsorshipRecord(
  type: string,
  overrides: Partial<HistoryOperationRecord> = {},
): HistoryOperationRecord {
  return {
    id: type,
    pagingToken: type,
    type,
    occurredAt: '2026-11-03T00:00:00Z',
    transactionHash: 'hash',
    sourceAccount: type === 'end_sponsoring_future_reserves' ? trustor : trustIssuer,
    successful: true,
    asset: { kind: 'credit', code: 'USD', issuer: trustIssuer },
    trustor,
    trustee: trustIssuer,
    authorize: true,
    authorizeToMaintainLiabilities: false,
    setFlags: [2],
    clearFlags: [1, 4],
    sponsoredId: trustor,
    beginSponsor: trustIssuer,
    ...overrides,
  };
}
