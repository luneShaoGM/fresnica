import type { HistoryOperationRecord } from '../HistoryGateway';
export const maintenanceSource = `G${'A'.repeat(55)}`;
export const maintenanceForeign = `G${'B'.repeat(55)}`;
export const maintenanceTypes = ['extend_footprint_ttl', 'restore_footprint', 'bump_sequence', 'manage_data'] as const;
export function maintenanceRecord(
  type: string,
  overrides: Partial<HistoryOperationRecord> = {},
): HistoryOperationRecord {
  return {
    id: type,
    pagingToken: type,
    type,
    sourceAccount: maintenanceSource,
    successful: true,
    occurredAt: '2026-11-03T00:00:00Z',
    transactionHash: 'hash',
    extendTo: 4294967295,
    bumpTo: '9223372036854775807',
    dataName: 'config.memo_required',
    ...overrides,
  };
}
