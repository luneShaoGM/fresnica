import type { HistoryOperationRecord } from './HistoryGateway';
import type { HistoryEntryBase, HistoryFailedEntry, HistoryFailedSubject, HistoryAsset } from './types';
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
  const accounts = Object.freeze([...related]);
  const type = record.type;
  let candidate: unknown = {
    kind: 'account',
    address: accounts.find(peer => peer !== address) ?? record.sourceAccount,
  };
  if (['manage_sell_offer', 'manage_buy_offer', 'create_passive_sell_offer'].includes(type))
    candidate = { kind: 'asset-pair', source: record.sellingAsset, destination: record.buyingAsset };
  else if (
    [
      'change_trust',
      'allow_trust',
      'set_trust_line_flags',
      'create_claimable_balance',
      'claim_claimable_balance',
      'clawback',
      'clawback_claimable_balance',
    ].includes(type)
  )
    candidate = { kind: 'asset', asset: record.asset };
  else if (['invoke_host_function', 'extend_footprint_ttl', 'restore_footprint'].includes(type))
    candidate = {
      kind: 'contract',
      ...(typeof record.contractId === 'string' && /^C[A-Z2-7]{55}$/.test(record.contractId)
        ? { identity: record.contractId }
        : {}),
    };
  const subject = normalizeFailedSubject(candidate, type, accounts);
  const safeBase = { ...base };
  delete safeBase.recipientMemo;
  return Object.freeze({
    ...safeBase,
    kind: 'failed',
    successful: false,
    relatedAccounts: accounts,
    ...(subject ? { subject } : {}),
  });
}
export function normalizeFailedHistory(entry: HistoryFailedEntry, address: string): HistoryFailedEntry {
  if (entry.recipientMemo !== undefined) throw new Error('history-cache-unproven-failed-memo');
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
    ...(entry.subject
      ? { subject: requireFailedSubject(entry.subject, entry.operationType, entry.relatedAccounts) }
      : {}),
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

function failedAsset(value: unknown): HistoryAsset | undefined {
  if (!value || typeof value !== 'object' || !('kind' in value)) return undefined;
  if (value.kind === 'native' && (!('code' in value) || value.code === 'XLM'))
    return Object.freeze({ kind: 'native', code: 'XLM' });
  if (
    value.kind === 'credit' &&
    'code' in value &&
    typeof value.code === 'string' &&
    /^[a-zA-Z0-9]{1,12}$/.test(value.code) &&
    'issuer' in value &&
    classic(value.issuer)
  )
    return Object.freeze({ kind: 'credit', code: value.code, issuer: value.issuer });
  return undefined;
}
function normalizeFailedSubject(
  value: unknown,
  operation: string,
  related: readonly string[],
): HistoryFailedSubject | undefined {
  if (!value || typeof value !== 'object' || !('kind' in value)) return undefined;
  if (value.kind === 'account' && 'address' in value && classic(value.address) && related.includes(value.address))
    return Object.freeze({ kind: 'account', address: value.address });
  if (
    value.kind === 'asset' &&
    ['change_trust', 'allow_trust', 'set_trust_line_flags', 'create_claimable_balance', 'clawback'].includes(
      operation,
    ) &&
    'asset' in value
  ) {
    const asset = failedAsset(value.asset);
    const issuerBound =
      asset?.kind === 'credit' &&
      (['allow_trust', 'set_trust_line_flags', 'clawback'].includes(operation)
        ? asset.issuer === related[0]
        : operation === 'change_trust'
          ? related.slice(1).includes(asset.issuer)
          : true);
    if (asset && (operation === 'create_claimable_balance' || issuerBound))
      return Object.freeze({ kind: 'asset', asset });
  }
  if (
    value.kind === 'asset-pair' &&
    ['manage_sell_offer', 'manage_buy_offer', 'create_passive_sell_offer'].includes(operation) &&
    'source' in value &&
    'destination' in value
  ) {
    const source = failedAsset(value.source);
    const destination = failedAsset(value.destination);
    if (source && destination) return Object.freeze({ kind: 'asset-pair', source, destination });
  }
  if (
    value.kind === 'contract' &&
    ['invoke_host_function', 'extend_footprint_ttl', 'restore_footprint'].includes(operation)
  ) {
    if (!('identity' in value)) return Object.freeze({ kind: 'contract' });
    if (typeof value.identity === 'string' && /^C[A-Z2-7]{55}$/.test(value.identity))
      return Object.freeze({ kind: 'contract', identity: value.identity });
  }
  return undefined;
}
function requireFailedSubject(value: unknown, operation: string, related: readonly string[]): HistoryFailedSubject {
  const subject = normalizeFailedSubject(value, operation, related);
  if (!subject) throw new Error('history-cache-invalid-failed-subject');
  return subject;
}
