import { mapHistoryEntry } from '../../../../capabilities/history/loadHistoryPage';
import { historySnapshot } from '../../__tests__/historyCacheRepositoryContract';
import { runHistoryCacheRepositoryContract } from '../../__tests__/historyCacheRepositoryContract';
import { InMemoryHistoryCacheRepository } from '../InMemoryHistoryCacheRepository';
import {
  trustSponsorshipRecord,
  trustSponsorshipTypes,
  trustIssuer,
  trustor,
  trustForeign,
} from '../../../../capabilities/history/__tests__/trustSponsorshipHistory.fixtures';
import {
  maintenanceRecord,
  maintenanceSource,
  maintenanceForeign,
  maintenanceTypes,
} from '../../../../capabilities/history/__tests__/maintenanceHistory.fixtures';
import {
  contractRecord,
  transfer,
  source,
  recipient,
} from '../../../../capabilities/history/__tests__/contractHistory.fixtures';

describe('InMemoryHistoryCacheRepository', () => {
  runHistoryCacheRepositoryContract(() => new InMemoryHistoryCacheRepository());
});

it('preserves both viewed sponsorship roles and trust evidence in isolated memory clones', () => {
  const repository = new InMemoryHistoryCacheRepository();
  for (const address of [trustIssuer, trustor]) {
    const partition = { networkId: 'test', accountAddress: address };
    const entries = trustSponsorshipTypes.map(type => mapHistoryEntry(trustSponsorshipRecord(type), address));
    const snapshot = historySnapshot(
      entries,
      entries.map(entry => ({ operationId: entry.id, entry })),
    );
    repository.replaceSnapshot(partition, snapshot);
    expect(repository.getSnapshot(partition)).toEqual(snapshot);
    expect(repository.getSnapshot(partition)).not.toBe(repository.getSnapshot(partition));
    expect(repository.getSnapshot({ ...partition, networkId: 'other' })).toBeUndefined();
    expect(() => repository.replaceSnapshot({ ...partition, accountAddress: trustForeign }, snapshot)).toThrow();
  }
});

it('retains maintenance and account data payloads and exact parameters in isolated memory partitions', () => {
  const partition = { networkId: 'test', accountAddress: maintenanceSource };
  const entries = maintenanceTypes.map(type => mapHistoryEntry(maintenanceRecord(type), maintenanceSource));
  const snapshot = historySnapshot(
    entries,
    entries.map(entry => ({ operationId: entry.id, entry })),
  );
  const repository = new InMemoryHistoryCacheRepository();
  repository.replaceSnapshot(partition, snapshot);
  expect(repository.getSnapshot(partition)).toEqual(snapshot);
  expect(repository.getSnapshot({ ...partition, accountAddress: maintenanceForeign })).toBeUndefined();
  expect(repository.getSnapshot({ ...partition, networkId: 'other' })).toBeUndefined();
  expect(() => repository.replaceSnapshot({ ...partition, accountAddress: maintenanceForeign }, snapshot)).toThrow();
});

it('retains an event recipient partition through contract memory clones', () => {
  const partition = { networkId: 'test', accountAddress: recipient };
  const entry = mapHistoryEntry(contractRecord({ assetBalanceChanges: [transfer] }), recipient);
  const snapshot = historySnapshot([entry], [{ operationId: entry.id, entry }]);
  const repository = new InMemoryHistoryCacheRepository();
  repository.replaceSnapshot(partition, snapshot);
  expect(repository.getSnapshot(partition)).toEqual(snapshot);
  expect(repository.getSnapshot(partition)).not.toBe(repository.getSnapshot(partition));
  expect(repository.getSnapshot({ ...partition, accountAddress: source })).toBeUndefined();
  expect(() => repository.replaceSnapshot({ ...partition, accountAddress: source }, snapshot)).toThrow();
});

it('retains a later claimant partition when creator is the first claimant during memory clone/read/write', () => {
  const creator = `G${'A'.repeat(55)}`;
  const claimant = `G${'B'.repeat(55)}`;
  const partition = { networkId: 'stellar-testnet', accountAddress: claimant };
  const record = {
    id: 'multi-claimant',
    pagingToken: '123',
    type: 'create_claimable_balance',
    occurredAt: '2026-11-03T00:00:00Z',
    transactionHash: 'hash',
    sourceAccount: creator,
    successful: true,
    asset: { kind: 'native' as const },
    amount: '1.0000001',
    claimants: [
      { destination: creator, predicate: { unconditional: true } },
      { destination: claimant, predicate: { rel_before: '60' } },
    ],
  };
  const entry = mapHistoryEntry(record, claimant);
  expect(entry).toMatchObject({ kind: 'claimable-create', role: 'claimant' });
  const snapshot = historySnapshot([entry], [{ operationId: entry.id, entry }]);
  const repository = new InMemoryHistoryCacheRepository();
  repository.replaceSnapshot(partition, snapshot);
  expect(repository.getSnapshot(partition)).toEqual(snapshot);
  expect(repository.getSnapshot({ ...partition, networkId: 'stellar-mainnet' })).toBeUndefined();
  expect(repository.getSnapshot({ ...partition, accountAddress: creator })).toBeUndefined();
  const creatorEntry = mapHistoryEntry(record, creator);
  expect(creatorEntry).toMatchObject({ kind: 'claimable-create', role: 'funder' });
  repository.replaceSnapshot({ ...partition, accountAddress: creator }, historySnapshot([creatorEntry]));
  expect(repository.getSnapshot(partition)?.details[0].entry).toEqual(entry);
  expect(repository.getSnapshot({ ...partition, accountAddress: creator })?.entries[0]).toEqual(creatorEntry);
});
