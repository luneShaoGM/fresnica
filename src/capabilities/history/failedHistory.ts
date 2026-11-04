import type { HistoryOperationRecord } from './HistoryGateway';
import type { HistoryEntryBase, HistoryFailedEntry } from './types';
import { mapClassicControl } from './classicControlHistory';

const classic = (value: unknown): value is string => typeof value === 'string' && /^G[A-Z2-7]{55}$/.test(value);
export function mapFailedHistory(
  record: HistoryOperationRecord,
  address: string,
  base: HistoryEntryBase,
): HistoryFailedEntry | undefined {
  if (record.successful !== false || record.sourceAccount !== base.sourceAccount || !classic(record.sourceAccount))
    return undefined;
  const related = new Set<string>([record.sourceAccount]);
  const add = (value: unknown) => {
    if (classic(value)) related.add(value);
  };
  if (['payment', 'path_payment_strict_send', 'path_payment_strict_receive'].includes(record.type)) add(record.to);
  if (record.type === 'clawback') add(record.from);
  if (record.type === 'create_account' && record.funder === record.sourceAccount) add(record.account);
  if (record.type === 'change_trust' && record.trustor === record.sourceAccount && record.asset?.kind === 'credit')
    add(record.asset.issuer);
  if (
    ['allow_trust', 'set_trust_line_flags'].includes(record.type) &&
    record.asset?.kind === 'credit' &&
    record.asset.issuer === record.sourceAccount
  )
    add(record.trustor);
  if (record.type === 'begin_sponsoring_future_reserves') add(record.sponsoredId);
  if (record.type === 'end_sponsoring_future_reserves') add(record.beginSponsor);
  if (record.type === 'create_claimable_balance' && Array.isArray(record.claimants) && record.claimants.length <= 10) {
    for (const claimant of record.claimants) if (claimant && typeof claimant === 'object') add(claimant.destination);
  }
  const control = mapClassicControl({ ...record, successful: true }, record.sourceAccount, base);
  if (control) {
    if (record.type === 'account_merge') add(control.parameters.into);
    if (record.type === 'revoke_sponsorship')
      for (const key of ['account_id', 'data_account_id', 'trustline_account_id', 'signer_account_id'])
        add(control.parameters[key]);
  }
  if (!related.has(address)) return undefined;
  return Object.freeze({ ...base, kind: 'failed', successful: false, relatedAccounts: Object.freeze([...related]) });
}
export function normalizeFailedHistory(entry: HistoryFailedEntry, address: string): HistoryFailedEntry {
  const peerTypes = [
    'payment',
    'path_payment_strict_send',
    'path_payment_strict_receive',
    'create_account',
    'change_trust',
    'allow_trust',
    'set_trust_line_flags',
    'begin_sponsoring_future_reserves',
    'end_sponsoring_future_reserves',
    'account_merge',
    'revoke_sponsorship',
    'clawback',
  ];
  const maximum =
    entry.operationType === 'create_claimable_balance' ? 11 : peerTypes.includes(entry.operationType) ? 2 : 1;
  if (
    entry.successful !== false ||
    !classic(entry.sourceAccount) ||
    !Array.isArray(entry.relatedAccounts) ||
    entry.relatedAccounts.length < 1 ||
    entry.relatedAccounts.length > maximum ||
    new Set(entry.relatedAccounts).size !== entry.relatedAccounts.length ||
    !Array.from(entry.relatedAccounts).every(classic) ||
    entry.relatedAccounts[0] !== entry.sourceAccount ||
    !entry.relatedAccounts.includes(address)
  )
    throw new Error('history-cache-invalid-entry');
  return Object.freeze({
    id: entry.id,
    pagingToken: entry.pagingToken,
    operationType: entry.operationType,
    occurredAt: entry.occurredAt,
    transactionHash: entry.transactionHash,
    sourceAccount: entry.sourceAccount,
    successful: false,
    kind: 'failed',
    relatedAccounts: Object.freeze(entry.relatedAccounts.slice()),
  });
}
export function isTechnicalHistoryOperation(type: string): boolean {
  return [
    'manage_data',
    'set_options',
    'bump_sequence',
    'extend_footprint_ttl',
    'restore_footprint',
    'allow_trust',
    'set_trust_line_flags',
    'begin_sponsoring_future_reserves',
    'end_sponsoring_future_reserves',
    'revoke_sponsorship',
    'inflation',
  ].includes(type);
}
