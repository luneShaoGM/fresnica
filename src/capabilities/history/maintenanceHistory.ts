import type { HistoryOperationRecord } from './HistoryGateway';
import type { HistoryEntryBase, HistoryMaintenanceEntry } from './types';

export function isMaintenanceType(type: string): boolean {
  return ['extend_footprint_ttl', 'restore_footprint', 'bump_sequence', 'manage_data'].includes(type);
}

export function mapMaintenance(
  record: HistoryOperationRecord,
  accountAddress: string,
  base: HistoryEntryBase,
): HistoryMaintenanceEntry | undefined {
  if (
    !isMaintenanceType(record.type) ||
    record.successful !== true ||
    !/^G[A-Z2-7]{55}$/.test(record.sourceAccount) ||
    record.sourceAccount !== base.sourceAccount ||
    record.sourceAccount !== accountAddress
  )
    return undefined;
  if (record.type === 'manage_data') {
    if (typeof record.dataName !== 'string' || !validDataName(record.dataName)) return undefined;
    return Object.freeze({ ...base, kind: 'maintenance', successful: true, dataName: record.dataName });
  }
  if (record.type === 'extend_footprint_ttl') {
    if (
      typeof record.extendTo !== 'number' ||
      !Number.isInteger(record.extendTo) ||
      record.extendTo < 0 ||
      record.extendTo > 4294967295
    )
      return undefined;
    return Object.freeze({ ...base, kind: 'maintenance', successful: true, extendTo: record.extendTo });
  }
  if (record.type === 'bump_sequence') {
    if (
      typeof record.bumpTo !== 'string' ||
      !/^(?:0|[1-9]\d{0,18})$/.test(record.bumpTo) ||
      BigInt(record.bumpTo) > 9223372036854775807n
    )
      return undefined;
    return Object.freeze({ ...base, kind: 'maintenance', successful: true, bumpTo: record.bumpTo });
  }
  return Object.freeze({ ...base, kind: 'maintenance', successful: true });
}

function validDataName(name: string): boolean {
  if (!name) return false;
  let bytes = 0;
  for (const character of name) {
    const point = character.codePointAt(0)!;
    if (point < 0x20 || (point >= 0x7f && point <= 0x9f) || (point >= 0xd800 && point <= 0xdfff)) return false;
    bytes += point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
    if (bytes > 64) return false;
  }
  return true;
}
