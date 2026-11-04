import { effectsRecord, effectsSource } from '../../../capabilities/history/__tests__/claimableEffects.fixtures';
import { mapHistoryEntry, loadHistoryPage } from '../../../capabilities/history/loadHistoryPage';
import { loadHistoryOperationDetails } from '../../../capabilities/history/loadHistoryOperationDetails';
import { cacheHistoryOnlineEntriesBestEffort, cacheHistoryReadyDetailBestEffort, buildHistoryCacheSnapshotFromOnlineEntries } from '../../../capabilities/history/HistoryCacheHydration';
import type { AccountRecord } from '../../../capabilities/account/types';
import { InMemoryHistoryCacheRepository } from '../../../platform/persistence/memory/InMemoryHistoryCacheRepository';
const partition = { networkId: 'test', accountAddress: effectsSource };
it('upgrades list and detail atomically, retains immutable validated proof, and seeds both live paths', async () => {
  const raw = effectsRecord(undefined, false);
  const plain = mapHistoryEntry(raw, effectsSource);
  const rich = mapHistoryEntry(effectsRecord(), effectsSource);
  const account = { networkId: 'test', identityKind: 'classic', address: effectsSource } as AccountRecord;
  const repository = new InMemoryHistoryCacheRepository();
  const loadOperationEffects = jest.fn(async () => {
    throw new Error('must reuse immutable evidence');
  });
  const gateway = {
    loadOperation: async () => ({ status: 'found' as const, record: raw }),
    loadAccountOperations: async () => ({ status: 'active' as const, address: effectsSource, records: [raw] }),
    loadOperationEffects,
  };
  const dependencies = { gateway, networkId: 'test', cache: repository, now: () => new Date() };
  expect(cacheHistoryOnlineEntriesBestEffort(dependencies, account, [plain])).toBe(true);
  expect(cacheHistoryReadyDetailBestEffort(dependencies, account, rich)).toBe(true);
  expect(repository.getSnapshot(partition)?.entries[0]).toEqual(rich);
  expect(repository.getSnapshot(partition)?.details[0].entry).toEqual(rich);
  expect(
    buildHistoryCacheSnapshotFromOnlineEntries(repository.getSnapshot(partition), [plain], new Date()).entries[0],
  ).toEqual(rich);
  expect(await loadHistoryOperationDetails(dependencies, account, raw.id)).toMatchObject({
    status: 'ready',
    entry: rich,
  });
  expect(await loadHistoryPage(dependencies, account)).toMatchObject({ status: 'active', entries: [rich] });
  expect(loadOperationEffects).not.toHaveBeenCalled();
  expect(repository.getSnapshot({ ...partition, networkId: 'other' })).toBeUndefined();
});
