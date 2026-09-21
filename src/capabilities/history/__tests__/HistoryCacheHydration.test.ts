import type { AccountRecord } from '../../account/types';
import { InMemoryHistoryCacheRepository } from '../../../platform/persistence/memory/InMemoryHistoryCacheRepository';
import { HISTORY_CACHE_SCHEMA_VERSION, type HistoryCacheSnapshot } from '../HistoryCacheRepository';
import {
  buildHistoryCacheSnapshotFromOnlineEntries,
  cacheHistoryOnlineEntriesBestEffort,
  cacheHistoryReadyDetailBestEffort,
  clearHistoryCacheBestEffort,
  historyCachePartition,
  readCachedHistoryDetail,
  readHistoryCacheSnapshotBestEffort,
  removeCachedHistoryDetailBestEffort,
  type HistoryProductDependencies,
} from '../HistoryCacheHydration';
import type { HistoryEntry } from '../types';

const now = new Date('2026-09-21T02:00:00.000Z');

describe('HistoryCacheHydration', () => {
  it('reuses a continuous cached tail after the last page-one overlap', () => {
    const cached = snapshot(
      [entry('5'), entry('4'), entry('3'), entry('2'), entry('1')],
      [{ operationId: '3', entry: entry('3') }],
    );

    const next = buildHistoryCacheSnapshotFromOnlineEntries(
      cached,
      [entry('7'), entry('6'), entry('5'), entry('4')],
      now,
    );

    expect(next.entries.map(item => item.id)).toEqual(['7', '6', '5', '4', '3', '2', '1']);
    expect(next.details).toEqual([{ operationId: '3', entry: entry('3') }]);
    expect(next.lastSuccessfulHorizonUpdateAt).toEqual(now);
  });

  it('drops the old cached tail and details when fresh page one has no overlap', () => {
    const cached = snapshot([entry('5'), entry('4'), entry('3')], [{ operationId: '3', entry: entry('3') }]);

    const next = buildHistoryCacheSnapshotFromOnlineEntries(cached, [entry('9'), entry('8')], now);

    expect(next.entries.map(item => item.id)).toEqual(['9', '8']);
    expect(next.details).toEqual([]);
  });

  it('preserves only cached details canonically equal to the retained entry', () => {
    const cached = snapshot(
      [entry('5'), entry('4'), entry('3')],
      [
        { operationId: '5', entry: entry('5') },
        { operationId: '3', entry: entry('3') },
      ],
    );
    const changedFive = { ...entry('5'), transactionHash: 'changed-tx' } as HistoryEntry;

    const next = buildHistoryCacheSnapshotFromOnlineEntries(cached, [changedFive, entry('4')], now);

    expect(next.entries.map(item => item.id)).toEqual(['5', '4', '3']);
    expect(next.details).toEqual([{ operationId: '3', entry: entry('3') }]);
  });

  it('keeps an empty cached snapshot distinct from a cache miss', () => {
    const dependencies = productDependencies();
    const current = account();
    dependencies.cache.replaceSnapshot({ networkId: current.networkId, accountAddress: current.address }, snapshot([]));

    expect(readHistoryCacheSnapshotBestEffort(dependencies, current)).toEqual(snapshot([]));
  });

  it('treats cache-read failure as a cache miss without changing the live-read path', () => {
    const dependencies = {
      networkId: 'stellar-testnet',
      cache: {
        getSnapshot: () => {
          throw new Error('corrupt-cache');
        },
      },
    };

    expect(readHistoryCacheSnapshotBestEffort(dependencies, account())).toBeUndefined();
  });

  it('contains snapshot-write failure instead of changing a successful online read into failure', () => {
    const dependencies: HistoryProductDependencies = {
      gateway: {
        loadAccountOperations: jest.fn(),
        loadOperation: jest.fn(),
      },
      networkId: 'stellar-testnet',
      cache: {
        getSnapshot: () => undefined,
        replaceSnapshot: () => {
          throw new Error('disk-full');
        },
        clearPartition: jest.fn(),
      },
      now: () => now,
    };

    let result: boolean | undefined;
    expect(() => {
      result = cacheHistoryOnlineEntriesBestEffort(dependencies, account(), [entry('1')]);
    }).not.toThrow();
    expect(result).toBe(false);
  });

  it('clears an authoritative inactive partition best effort', () => {
    const dependencies = productDependencies();
    const current = account();
    cacheHistoryOnlineEntriesBestEffort(dependencies, current, [entry('1')]);

    expect(clearHistoryCacheBestEffort(dependencies, current)).toBe(true);
    expect(readHistoryCacheSnapshotBestEffort(dependencies, current)).toBeUndefined();
  });

  it('persists online entries best effort without persisting any cursor chain', () => {
    const dependencies = productDependencies();
    const current = account();

    expect(cacheHistoryOnlineEntriesBestEffort(dependencies, current, [entry('2'), entry('1')])).toBe(true);

    expect(
      dependencies.cache.getSnapshot({
        networkId: current.networkId,
        accountAddress: current.address,
      }),
    ).toEqual(snapshot([entry('2'), entry('1')], [], now));
  });

  it('updates and removes a ready detail only when it matches a retained list entry', () => {
    const dependencies = productDependencies();
    const current = account();
    cacheHistoryOnlineEntriesBestEffort(dependencies, current, [entry('2'), entry('1')]);

    expect(cacheHistoryReadyDetailBestEffort(dependencies, current, entry('2'))).toBe(true);
    const cached = readHistoryCacheSnapshotBestEffort(dependencies, current);
    expect(readCachedHistoryDetail(cached, '2')).toEqual(entry('2'));

    expect(
      cacheHistoryReadyDetailBestEffort(dependencies, current, {
        ...entry('1'),
        transactionHash: 'contradictory',
      } as HistoryEntry),
    ).toBe(false);
    expect(removeCachedHistoryDetailBestEffort(dependencies, current, '2')).toBe(true);
    expect(readCachedHistoryDetail(readHistoryCacheSnapshotBestEffort(dependencies, current), '2')).toBeUndefined();
  });

  it('uses network plus classic address as the partition and rejects network drift', () => {
    expect(historyCachePartition({ networkId: 'stellar-testnet' }, account())).toEqual({
      networkId: 'stellar-testnet',
      accountAddress: 'GACCOUNT',
    });
    expect(
      historyCachePartition({ networkId: 'stellar-testnet' }, account({ identityKind: 'contract' })),
    ).toBeUndefined();
    expect(() =>
      historyCachePartition({ networkId: 'stellar-mainnet' }, account({ networkId: 'stellar-testnet' })),
    ).toThrow('history-network-mismatch');
  });
});

function productDependencies(): HistoryProductDependencies {
  return {
    gateway: {
      loadAccountOperations: jest.fn(),
      loadOperation: jest.fn(),
    },
    networkId: 'stellar-testnet',
    cache: new InMemoryHistoryCacheRepository(),
    now: () => now,
  };
}

function account(input: Partial<AccountRecord> = {}): AccountRecord {
  return {
    id: 'account-1',
    address: 'GACCOUNT',
    identityKind: 'classic',
    networkId: 'stellar-testnet',
    label: 'Account',
    sortOrder: 0,
    hidden: false,
    createdAt: now,
    updatedAt: now,
    ...input,
  };
}

function snapshot(
  entries: readonly HistoryEntry[],
  details: HistoryCacheSnapshot['details'] = [],
  updatedAt = new Date('2026-09-20T02:00:00.000Z'),
): HistoryCacheSnapshot {
  return {
    schemaVersion: HISTORY_CACHE_SCHEMA_VERSION,
    lastSuccessfulHorizonUpdateAt: updatedAt,
    entries,
    details,
  };
}

function entry(id: string): HistoryEntry {
  return {
    id,
    pagingToken: id,
    operationType: 'future_operation',
    occurredAt: '2026-09-20T01:00:00.000Z',
    transactionHash: `tx-${id}`,
    sourceAccount: 'GACCOUNT',
    kind: 'unsupported',
    reason: 'operation-type',
  };
}
