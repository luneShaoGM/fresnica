import type { HistoryOperationRecord } from './HistoryGateway';
import { isPathAmount, pathAsset } from './pathPaymentHistory';
import type {
  HistoryBalanceReferenceEntry,
  HistoryClaimableEntry,
  HistoryClawbackEntry,
  HistoryClaimPredicate,
  HistoryClaimant,
  HistoryEntryBase,
} from './types';

export function isClaimableClawbackType(type: string): boolean {
  return ['create_claimable_balance', 'claim_claimable_balance', 'clawback', 'clawback_claimable_balance'].includes(
    type,
  );
}
function classic(value: unknown): value is string {
  return typeof value === 'string' && /^G[A-Z2-7]{55}$/.test(value);
}
function recordObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function timeInteger(value: unknown): value is string {
  if (typeof value !== 'string' || !/^-?\d{1,19}$/.test(value)) return false;
  const n = BigInt(value);
  return n >= -9_223_372_036_854_775_808n && n <= 9_223_372_036_854_775_807n;
}
// Preserve ledger condition text; history never evaluates eligibility against device time.
export function normalizeClaimPredicate(value: unknown, depth = 0): HistoryClaimPredicate | undefined {
  if (depth > 4 || !recordObject(value)) return undefined;
  const aliases: Record<string, string> = {
    absBefore: 'abs_before',
    absBeforeEpoch: 'abs_before_epoch',
    relBefore: 'rel_before',
  };
  const fields: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(value)) {
    const name = aliases[key] ?? key;
    if (!['unconditional', 'and', 'or', 'not', 'abs_before', 'abs_before_epoch', 'rel_before'].includes(name))
      return undefined;
    if (name in fields && fields[name] !== field) return undefined;
    fields[name] = field;
  }
  const keys = Object.keys(fields).filter(key => key !== 'abs_before_epoch' || fields.abs_before === undefined);
  if (keys.length !== 1) return undefined;
  const key = keys[0];
  if (key === 'unconditional') return fields[key] === true ? Object.freeze({ unconditional: true }) : undefined;
  if (key === 'and' || key === 'or') {
    const pair = fields[key];
    if (!Array.isArray(pair) || pair.length !== 2) return undefined;
    const first = normalizeClaimPredicate(pair[0], depth + 1);
    const second = normalizeClaimPredicate(pair[1], depth + 1);
    if (!first || !second) return undefined;
    const children = Object.freeze([first, second]) as readonly [HistoryClaimPredicate, HistoryClaimPredicate];
    return key === 'and' ? Object.freeze({ and: children }) : Object.freeze({ or: children });
  }
  if (key === 'not') {
    const child = normalizeClaimPredicate(fields.not, depth + 1);
    return child ? Object.freeze({ not: child }) : undefined;
  }
  if (key === 'rel_before') return timeInteger(fields[key]) ? Object.freeze({ rel_before: fields[key] }) : undefined;
  if (key === 'abs_before_epoch')
    return timeInteger(fields[key]) ? Object.freeze({ abs_before_epoch: fields[key] }) : undefined;
  const text = fields.abs_before;
  if (
    typeof text !== 'string' ||
    !/^[-+]?\d{4,12}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,7})?Z$/.test(
      text,
    )
  )
    return undefined;
  if (fields.abs_before_epoch !== undefined && !timeInteger(fields.abs_before_epoch)) return undefined;
  return Object.freeze({
    abs_before: text,
    ...(fields.abs_before_epoch === undefined ? {} : { abs_before_epoch: fields.abs_before_epoch as string }),
  });
}
function claimants(value: unknown): readonly HistoryClaimant[] | undefined {
  if (!Array.isArray(value) || value.length < 1 || value.length > 10) return undefined;
  const result: HistoryClaimant[] = [];
  for (const claimant of value) {
    if (!recordObject(claimant) || !classic(claimant.destination)) return undefined;
    const predicate = normalizeClaimPredicate(claimant.predicate);
    if (!predicate) return undefined;
    result.push(Object.freeze({ destination: claimant.destination, predicate }));
  }
  return Object.freeze(result);
}
export function claimableClawbackAssociated(record: HistoryOperationRecord, address: string): boolean {
  if (record.type === 'create_claimable_balance') {
    if (record.sourceAccount === address) return true;
    const candidates = record.claimants;
    return (
      Array.isArray(candidates) &&
      candidates.length >= 1 &&
      candidates.length <= 10 &&
      candidates.every(candidate => recordObject(candidate) && classic(candidate.destination)) &&
      candidates.some(candidate => candidate.destination === address)
    );
  }
  if (record.type === 'clawback') return record.sourceAccount === address || record.from === address;
  return record.sourceAccount === address && (record.type !== 'claim_claimable_balance' || record.claimant === address);
}
export function mapClaimableClawback(
  record: HistoryOperationRecord,
  accountAddress: string,
  base: HistoryEntryBase,
): HistoryClaimableEntry | HistoryBalanceReferenceEntry | HistoryClawbackEntry | undefined {
  if (
    !isClaimableClawbackType(record.type) ||
    record.successful !== true ||
    record.sourceAccount !== base.sourceAccount ||
    !classic(record.sourceAccount) ||
    !claimableClawbackAssociated(record, accountAddress)
  )
    return undefined;
  if (record.type === 'create_claimable_balance') {
    const asset = pathAsset(record.asset);
    const entries = claimants(record.claimants);
    if (!asset || !entries || !isPathAmount(record.amount)) return undefined;
    const role =
      accountAddress !== base.sourceAccount
        ? 'claimant'
        : asset.kind === 'credit' && asset.issuer === base.sourceAccount
          ? 'issuer'
          : 'funder';
    return Object.freeze({
      ...base,
      kind: 'claimable-create',
      successful: true,
      asset,
      amount: record.amount,
      claimants: entries,
      role,
    });
  }
  if (record.type === 'clawback') {
    const asset = pathAsset(record.asset);
    if (
      !asset ||
      asset.kind !== 'credit' ||
      asset.issuer !== base.sourceAccount ||
      !classic(record.from) ||
      record.from === asset.issuer ||
      !isPathAmount(record.amount, true) ||
      (record.fromMuxed !== undefined &&
        (typeof record.fromMuxed !== 'string' || !/^M[A-Z2-7]{68}$/.test(record.fromMuxed)))
    )
      return undefined;
    return Object.freeze({
      ...base,
      kind: 'clawback',
      successful: true,
      asset,
      amount: record.amount,
      holder: record.fromMuxed ?? record.from,
      holderBase: record.from,
      role: accountAddress === base.sourceAccount ? 'issuer' : 'holder',
    });
  }
  if (
    typeof record.balanceId !== 'string' ||
    !/^00000000[a-f0-9]{64}$/.test(record.balanceId) ||
    (record.type === 'claim_claimable_balance' && record.claimant !== base.sourceAccount)
  )
    return undefined;
  return Object.freeze({ ...base, kind: 'claimable-reference', successful: true, balanceId: record.balanceId });
}
