import {
  HISTORY_CACHE_SCHEMA_VERSION,
  replaceHistoryCacheSnapshotBestEffort,
  type HistoryCacheSnapshot,
} from '../HistoryCacheRepository';

const partition = {
  networkId: 'stellar-testnet',
  accountAddress: 'GACCOUNT',
};

const snapshot: HistoryCacheSnapshot = {
  schemaVersion: HISTORY_CACHE_SCHEMA_VERSION,
  lastSuccessfulHorizonUpdateAt: new Date('2026-09-20T09:00:00.000Z'),
  entries: [],
  details: [],
};

describe('replaceHistoryCacheSnapshotBestEffort', () => {
  it('returns true after a successful durable write', () => {
    const replaceSnapshot = jest.fn();

    expect(replaceHistoryCacheSnapshotBestEffort({ replaceSnapshot }, partition, snapshot)).toBe(true);
    expect(replaceSnapshot).toHaveBeenCalledWith(partition, snapshot);
  });

  it('contains cache-write failure so a successful live read can remain usable', () => {
    const replaceSnapshot = jest.fn(() => {
      throw new Error('disk-full');
    });

    let result: boolean | undefined;
    expect(() => {
      result = replaceHistoryCacheSnapshotBestEffort({ replaceSnapshot }, partition, snapshot);
    }).not.toThrow();
    expect(result).toBe(false);
  });
});
