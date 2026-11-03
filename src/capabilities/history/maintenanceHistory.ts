import type { HistoryOperationRecord } from './HistoryGateway';
import type { HistoryEntryBase, HistoryMaintenanceEntry } from './types';

export function isMaintenanceType(type: string): boolean {
  return ['extend_footprint_ttl', 'restore_footprint', 'bump_sequence'].includes(type);
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
