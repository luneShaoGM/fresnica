import {
  HISTORY_CACHE_MAX_ENTRIES,
  HISTORY_CACHE_SCHEMA_VERSION,
  type HistoryCachePartition,
  type HistoryCacheRepository,
  type HistoryCacheSnapshot,
} from '../../../capabilities/history/HistoryCacheRepository';
import type { HistoryEntry } from '../../../capabilities/history/types';

const partitionA: HistoryCachePartition = {
  networkId: 'stellar-testnet',
  accountAddress: 'GACCOUNT-A',
};
const partitionB: HistoryCachePartition = {
  networkId: 'stellar-testnet',
  accountAddress: 'GACCOUNT-B',
};
const mainnetPartitionA: HistoryCachePartition = {
  networkId: 'stellar-mainnet',
  accountAddress: 'GACCOUNT-A',
};
const updatedAt = new Date('2026-09-20T09:00:00.000Z');

export function runHistoryCacheRepositoryContract(createRepository: () => HistoryCacheRepository): void {
  it('stores only canonical normalized History DTO fields', () => {
    const repository = createRepository();
    const pollutedPayment = {
      ...payment('5'),
      _links: { self: { href: 'raw-horizon-link' } },
      rawHorizonOnly: 'must-not-persist',
    } as unknown as HistoryEntry;
    const snapshot = historySnapshot(
      [
        pollutedPayment,
        createAccount('4'),
        changeTrust('3'),
        unsupportedShape('2', 'payment'),
        unsupported('1', 'future_operation'),
      ],
      [
        { operationId: '5', entry: payment('5') },
        { operationId: '2', entry: unsupportedShape('2', 'payment') },
        { operationId: '1', entry: unsupported('1', 'future_operation') },
      ],
    );

    repository.replaceSnapshot(partitionA, snapshot);

    const restored = repository.getSnapshot(partitionA);
    expect(restored).toEqual({
      ...snapshot,
      entries: [
        payment('5'),
        createAccount('4'),
        changeTrust('3'),
        unsupportedShape('2', 'payment'),
        unsupported('1', 'future_operation'),
      ],
    });
    expect(restored?.details).toEqual([
      { operationId: '5', entry: payment('5') },
      { operationId: '2', entry: unsupportedShape('2', 'payment') },
      { operationId: '1', entry: unsupported('1', 'future_operation') },
    ]);
    expect(JSON.stringify(restored)).not.toContain('cursor');
    expect(JSON.stringify(restored)).not.toContain('acceptedCursors');
    expect(JSON.stringify(restored)).not.toContain('raw-horizon-link');
    expect(JSON.stringify(restored)).not.toContain('rawHorizonOnly');
  });

  it.each(semanticallyInvalidEntries())(
    'rejects invalid %s entries without replacing the valid partition',
    (_caseName, invalidEntry) => {
      const repository = createRepository();
      const valid = historySnapshot([payment('valid')]);
      repository.replaceSnapshot(partitionA, valid);

      expect(() => repository.replaceSnapshot(partitionA, historySnapshot([invalidEntry]))).toThrow(
        'history-cache-invalid-entry',
      );
      expect(repository.getSnapshot(partitionA)).toEqual(valid);
    },
  );

  it('strictly isolates snapshots by network and classic account address', () => {
    const repository = createRepository();
    repository.replaceSnapshot(partitionA, historySnapshot([payment('testnet-a')]));
    repository.replaceSnapshot(partitionB, historySnapshot([payment('testnet-b')]));
    repository.replaceSnapshot(mainnetPartitionA, historySnapshot([payment('mainnet-a')]));

    expect(repository.getSnapshot(partitionA)?.entries.map(entry => entry.id)).toEqual(['testnet-a']);
    expect(repository.getSnapshot(partitionB)?.entries.map(entry => entry.id)).toEqual(['testnet-b']);
    expect(repository.getSnapshot(mainnetPartitionA)?.entries.map(entry => entry.id)).toEqual(['mainnet-a']);
  });

  it('deduplicates by operation id, preserves gateway order, and retains at most 500 entries', () => {
    const repository = createRepository();
    const entries = Array.from({ length: HISTORY_CACHE_MAX_ENTRIES + 2 }, (_, index) =>
      payment(String(HISTORY_CACHE_MAX_ENTRIES + 2 - index)),
    );
    entries.splice(1, 0, payment(entries[0].id));

    repository.replaceSnapshot(partitionA, historySnapshot(entries));

    const restored = repository.getSnapshot(partitionA);
    expect(restored?.entries).toHaveLength(HISTORY_CACHE_MAX_ENTRIES);
    expect(restored?.entries.slice(0, 3).map(entry => entry.id)).toEqual(['502', '501', '500']);
    expect(restored?.entries.at(-1)?.id).toBe('3');
  });

  it('restores explicit unsupported details and drops details outside the retained bound', () => {
    const repository = createRepository();
    const entries = Array.from({ length: HISTORY_CACHE_MAX_ENTRIES + 1 }, (_, index) =>
      unsupported(String(HISTORY_CACHE_MAX_ENTRIES + 1 - index), 'future_operation'),
    );
    const retainedDetail = { operationId: '500', entry: unsupported('500', 'future_operation') };
    const trimmedDetail = { operationId: '1', entry: unsupported('1', 'future_operation') };

    repository.replaceSnapshot(partitionA, historySnapshot(entries, [retainedDetail, retainedDetail, trimmedDetail]));

    expect(repository.getSnapshot(partitionA)?.details).toEqual([retainedDetail]);
  });

  it('rejects non-ready detail data without overwriting the last valid snapshot', () => {
    const repository = createRepository();
    const valid = historySnapshot([payment('1')]);
    repository.replaceSnapshot(partitionA, valid);

    const invalid = {
      ...valid,
      details: [
        {
          operationId: '1',
          entry: { status: 'error' },
        },
      ],
    } as unknown as HistoryCacheSnapshot;

    expect(() => repository.replaceSnapshot(partitionA, invalid)).toThrow('history-cache-invalid-detail');
    expect(repository.getSnapshot(partitionA)).toEqual(valid);
  });

  it('rejects a ready detail that contradicts the retained list entry with the same operation id', () => {
    const repository = createRepository();
    const valid = historySnapshot([payment('1')]);
    repository.replaceSnapshot(partitionA, valid);

    const contradictoryDetail = {
      ...payment('1'),
      amount: '9.9999999',
    } as HistoryEntry;

    expect(() =>
      repository.replaceSnapshot(
        partitionA,
        historySnapshot([payment('1')], [{ operationId: '1', entry: contradictoryDetail }]),
      ),
    ).toThrow('history-cache-detail-mismatch');
    expect(repository.getSnapshot(partitionA)).toEqual(valid);
  });

  it('rejects an incompatible snapshot schema without overwriting the valid partition', () => {
    const repository = createRepository();
    const valid = historySnapshot([payment('valid')]);
    repository.replaceSnapshot(partitionA, valid);

    const incompatible = {
      ...valid,
      schemaVersion: HISTORY_CACHE_SCHEMA_VERSION + 1,
    } as unknown as HistoryCacheSnapshot;

    expect(() => repository.replaceSnapshot(partitionA, incompatible)).toThrow('history-cache-schema-incompatible');
    expect(repository.getSnapshot(partitionA)).toEqual(valid);
  });

  it('clears only the requested partition', () => {
    const repository = createRepository();
    repository.replaceSnapshot(partitionA, historySnapshot([payment('a')]));
    repository.replaceSnapshot(partitionB, historySnapshot([payment('b')]));

    repository.clearPartition(partitionA);

    expect(repository.getSnapshot(partitionA)).toBeUndefined();
    expect(repository.getSnapshot(partitionB)?.entries.map(entry => entry.id)).toEqual(['b']);
  });
}

export function historySnapshot(
  entries: readonly HistoryEntry[],
  details: HistoryCacheSnapshot['details'] = [],
): HistoryCacheSnapshot {
  return {
    schemaVersion: HISTORY_CACHE_SCHEMA_VERSION,
    lastSuccessfulHorizonUpdateAt: updatedAt,
    entries,
    details,
  };
}

export function payment(id: string): HistoryEntry {
  return {
    id,
    pagingToken: `paging-${id}`,
    operationType: 'payment',
    occurredAt: '2026-09-20T08:00:00Z',
    transactionHash: `tx-${id}`,
    sourceAccount: 'GSOURCE',
    kind: 'payment',
    direction: 'outgoing',
    amount: '1.2500000',
    asset: { kind: 'native', code: 'XLM' },
    counterparty: 'GDESTINATION',
    participants: [
      { role: 'sender', identity: 'GSOURCE' },
      { role: 'recipient', identity: 'GDESTINATION' },
    ],
  };
}

function createAccount(id: string): HistoryEntry {
  return {
    id,
    pagingToken: `paging-${id}`,
    operationType: 'create_account',
    occurredAt: '2026-09-20T08:00:00Z',
    transactionHash: `tx-${id}`,
    sourceAccount: 'GFUNDER',
    kind: 'create-account',
    direction: 'outgoing',
    startingBalance: '3.5000000',
    counterparty: 'GCREATED',
    participants: [
      { role: 'funder', identity: 'GFUNDER' },
      { role: 'created-account', identity: 'GCREATED' },
    ],
  };
}

export function unsupported(id: string, operationType: string): HistoryEntry {
  return {
    id,
    pagingToken: `paging-${id}`,
    operationType,
    occurredAt: '2026-09-20T08:00:00Z',
    transactionHash: `tx-${id}`,
    sourceAccount: 'GSOURCE',
    kind: 'unsupported',
    reason: 'operation-type',
  };
}

function unsupportedShape(id: string, operationType: 'payment' | 'create_account' | 'change_trust'): HistoryEntry {
  return {
    id,
    pagingToken: `paging-${id}`,
    operationType,
    occurredAt: '2026-09-20T08:00:00Z',
    transactionHash: `tx-${id}`,
    sourceAccount: 'GSOURCE',
    kind: 'unsupported',
    reason: 'operation-shape',
  };
}

function changeTrust(id: string): HistoryEntry {
  return {
    id,
    pagingToken: `paging-${id}`,
    operationType: 'change_trust',
    occurredAt: '2026-09-20T08:00:00Z',
    transactionHash: `tx-${id}`,
    sourceAccount: 'GSOURCE',
    kind: 'change-trust',
    asset: { kind: 'credit', code: 'MiXeD', issuer: 'GISSUER' },
    limit: '100.0000000',
    participants: [
      { role: 'trustor', identity: 'GSOURCE' },
      { role: 'issuer', identity: 'GISSUER' },
    ],
  };
}

function semanticallyInvalidEntries(): readonly (readonly [string, HistoryEntry])[] {
  return [
    [
      'payment kind/type mismatch',
      {
        ...payment('invalid-payment-type'),
        operationType: 'create_account',
      } as HistoryEntry,
    ],
    [
      'payment participant roles',
      {
        ...payment('invalid-payment-roles'),
        participants: [
          { role: 'recipient', identity: 'GSOURCE' },
          { role: 'sender', identity: 'GDESTINATION' },
        ],
      } as HistoryEntry,
    ],
    [
      'create-account kind/type mismatch',
      {
        ...createAccount('invalid-create-type'),
        operationType: 'payment',
      } as HistoryEntry,
    ],
    [
      'change-trust participant identity',
      {
        ...changeTrust('invalid-change-trust-issuer'),
        participants: [
          { role: 'trustor', identity: 'GSOURCE' },
          { role: 'issuer', identity: 'GOTHERISSUER' },
        ],
      } as HistoryEntry,
    ],
    ['unsupported reason/family mismatch', unsupported('invalid-unsupported-reason', 'payment')],
    [
      'occurredAt timestamp',
      {
        ...payment('invalid-occurred-at'),
        occurredAt: 'not-a-date',
      } as HistoryEntry,
    ],
  ];
}
