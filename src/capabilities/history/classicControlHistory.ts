import type { HistoryOperationRecord } from './HistoryGateway';
import type { HistoryControlEntry, HistoryEntryBase, HistoryControlParameters } from './types';

export const CLASSIC_CONTROL_TYPES = ['account_merge', 'set_options', 'revoke_sponsorship', 'inflation'] as const;
export function isClassicControlType(type: string): boolean {
  return (CLASSIC_CONTROL_TYPES as readonly string[]).includes(type);
}
const ownerKeys = ['account_id', 'data_account_id', 'trustline_account_id', 'signer_account_id'];
export function classicControlAssociated(record: HistoryOperationRecord, address: string): boolean {
  if (record.sourceAccount === address) return true;
  const raw = record.controlParameters;
  if (!object(raw)) return false;
  if (record.type === 'account_merge') return classic(raw.into) && raw.into === address;
  if (record.type === 'revoke_sponsorship') return ownerKeys.some(key => classic(raw[key]) && raw[key] === address);
  return false;
}
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function classic(value: unknown): value is string {
  return typeof value === 'string' && /^G[A-Z2-7]{55}$/.test(value);
}
function signer(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (/^[GTX][A-Z2-7]{55}$/.test(value)) return true;
  return (
    /^P[A-Z2-7]{68,164}$/.test(value) &&
    Array.from({ length: 16 }, (_, index) => Math.ceil(((43 + index * 4) * 8) / 5)).includes(value.length)
  );
}
function text(value: unknown, max: number, empty = false): value is string {
  if (typeof value !== 'string' || (!empty && !value)) return false;
  let size = 0;
  for (const c of value) {
    const point = c.codePointAt(0)!;
    if (point < 32 || (point >= 127 && point <= 159) || (point >= 0xd800 && point <= 0xdfff)) return false;
    size += point <= 127 ? 1 : point <= 2047 ? 2 : point <= 65535 ? 3 : 4;
    if (size > max) return false;
  }
  return true;
}
function flags(value: unknown): value is readonly number[] {
  return (
    Array.isArray(value) &&
    value.length <= 4 &&
    new Set(value).size === value.length &&
    Array.from(value).every(bit => [1, 2, 4, 8].includes(bit))
  );
}
const revokeKeys = [
  'account_id',
  'claimable_balance_id',
  'data_account_id',
  'data_name',
  'offer_id',
  'trustline_account_id',
  'trustline_asset',
  'trustline_liquidity_pool_id',
  'signer_account_id',
  'signer_key',
];
const optionKeys = [
  'inflation_dest',
  'home_domain',
  'master_key_weight',
  'low_threshold',
  'med_threshold',
  'high_threshold',
  'signer_key',
  'signer_weight',
  'set_flags',
  'clear_flags',
];
export function mapClassicControl(
  record: HistoryOperationRecord,
  address: string,
  base: HistoryEntryBase,
): HistoryControlEntry | undefined {
  if (
    !isClassicControlType(record.type) ||
    record.successful !== true ||
    !classic(record.sourceAccount) ||
    record.sourceAccount !== base.sourceAccount ||
    !classicControlAssociated(record, address)
  )
    return undefined;
  const raw = record.controlParameters;
  if (!object(raw)) return undefined;
  const parameters: Record<string, string | number | readonly number[]> = {};
  let peer: string | undefined;
  if (record.type === 'account_merge') {
    if (raw.account !== record.sourceAccount || !classic(raw.into) || raw.into === record.sourceAccount)
      return undefined;
    parameters.account = record.sourceAccount;
    parameters.into = raw.into;
    peer = address === record.sourceAccount ? raw.into : record.sourceAccount;
  } else if (record.type === 'set_options') {
    for (const key of optionKeys) {
      const value = raw[key];
      if (value === undefined) continue;
      if (
        key === 'inflation_dest'
          ? !classic(value)
          : key === 'home_domain'
            ? !text(value, 32, true)
            : key === 'signer_key'
              ? !signer(value)
              : key.endsWith('_flags')
                ? !flags(value)
                : typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 255
      )
        return undefined;
      parameters[key] = Array.isArray(value) ? Object.freeze(value.slice()) : (value as string | number);
    }
    if ((parameters.signer_key === undefined) !== (parameters.signer_weight === undefined)) return undefined;
    const set = parameters.set_flags as readonly number[] | undefined;
    const clear = parameters.clear_flags as readonly number[] | undefined;
    if (set?.some(bit => clear?.includes(bit))) return undefined;
  } else if (record.type === 'revoke_sponsorship') {
    const present = revokeKeys.filter(key => raw[key] !== undefined);
    const families = [
      ['account_id'],
      ['claimable_balance_id'],
      ['data_account_id', 'data_name'],
      ['offer_id'],
      ['trustline_account_id', 'trustline_asset'],
      ['trustline_account_id', 'trustline_liquidity_pool_id'],
      ['signer_account_id', 'signer_key'],
    ];
    if (!families.some(keys => keys.length === present.length && keys.every(key => present.includes(key))))
      return undefined;
    for (const key of present) {
      const value = raw[key];
      if (
        ownerKeys.includes(key)
          ? !classic(value)
          : key === 'data_name'
            ? !text(value, 64)
            : key === 'signer_key'
              ? !signer(value)
              : key === 'claimable_balance_id'
                ? typeof value !== 'string' || !/^00000000[0-9a-fA-F]{64}$/.test(value)
                : key === 'trustline_liquidity_pool_id'
                  ? typeof value !== 'string' || !/^[0-9a-fA-F]{64}$/.test(value)
                  : key === 'trustline_asset'
                    ? typeof value !== 'string' || !/^[a-zA-Z0-9]{1,12}:G[A-Z2-7]{55}$/.test(value)
                    : typeof value !== 'string' ||
                      !/^[1-9]\d{0,18}$/.test(value) ||
                      BigInt(value) > 9223372036854775807n
      )
        return undefined;
      parameters[key] = value as string;
    }
  }
  return Object.freeze({
    ...base,
    kind: 'account-control',
    successful: true,
    parameters: Object.freeze(parameters) as HistoryControlParameters,
    ...(peer === undefined ? {} : { counterparty: peer }),
  });
}
