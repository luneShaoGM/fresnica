import { CONTRACT_HOST_FUNCTIONS } from '../contractHistory';
import { normalizeHistoryCacheSnapshot } from '../HistoryCacheRepository';
import type { HistoryOperationRecord } from '../HistoryGateway';
import type { HistoryEntry } from '../types';
export const source = `G${'A'.repeat(55)}`;
export const recipient = `G${'B'.repeat(55)}`;
export const foreign = `G${'D'.repeat(55)}`;
export const contractId = `C${'A'.repeat(55)}`;
export function contractRecord(overrides: Partial<HistoryOperationRecord> = {}): HistoryOperationRecord {
  return {
    id: '123',
    pagingToken: '123',
    type: 'invoke_host_function',
    occurredAt: '2026-11-03T00:00:00Z',
    transactionHash: 'hash',
    sourceAccount: source,
    successful: true,
    hostFunction: CONTRACT_HOST_FUNCTIONS.invoke,
    contractId,
    creationOrigin: 'address',
    deployer: source,
    functionName: 'transfer',
    ...overrides,
  };
}
export const transfer = {
  type: 'transfer',
  asset: { kind: 'native' },
  amount: '1.0000001',
  from: source,
  to: recipient,
};
export function cache(entry: HistoryEntry, address = source) {
  return normalizeHistoryCacheSnapshot(
    {
      schemaVersion: 1,
      lastSuccessfulHorizonUpdateAt: new Date(),
      entries: [entry],
      details: [{ operationId: entry.id, entry }],
    },
    { networkId: 'test', accountAddress: address },
  );
}
