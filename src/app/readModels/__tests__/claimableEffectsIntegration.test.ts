import { createDisplayReadGateway } from '../createDisplayReadGateway';
import { createLedgerReadRuntime } from '../LedgerReadRuntime';
import { effectsProof, effectsRecord, effectsSource } from '../../../capabilities/history/__tests__/claimableEffects.fixtures';
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

const lifecycleAccount = { networkId: 'test', identityKind: 'classic', address: effectsSource } as AccountRecord;
it.each(['page', 'detail'] as const)('%s preserves optional effects failure and timeout fallback', async path => {
  jest.useFakeTimers();
  try {
    const raw = effectsRecord(undefined, false);
    for (const timeout of [false, true]) {
      const runtime = createLedgerReadRuntime();
      const gateway = createDisplayReadGateway({
        runtime, getAccountRevision: () => '1',
        gateway: {
          loadAccountBalances: jest.fn(),
          loadAccountOperations: async () => ({ status: 'active', address: effectsSource, records: [raw] }),
          loadOperation: async () => ({ status: 'found', record: raw }),
          loadOperationEffects: async () => {
            if (timeout) return new Promise(() => {});
            throw new Error('node-read-unavailable');
          },
        },
      });
      const dependencies = { gateway, networkId: 'test' };
      const request = path === 'page' ? loadHistoryPage(dependencies, lifecycleAccount) : loadHistoryOperationDetails(dependencies, lifecycleAccount, raw.id);
      await jest.advanceTimersByTimeAsync(6000);
      const result = await request;
      expect(result).toMatchObject(path === 'page' ? { status: 'active', entries: [{ kind: 'claimable-reference' }] } : { status: 'ready', entry: { kind: 'claimable-reference' } });
      expect(JSON.stringify(result)).not.toContain('evidence');
    }
  } finally {
    jest.useRealTimers();
  }
});
it.each(['page', 'detail'] as const)('%s rejects lifecycle changes during enrichment, including the budget race', async path => {
  jest.useFakeTimers();
  try {
    for (const change of ['offline', 'background', 'revision'] as const) {
      for (const timeout of [false, true]) {
        const raw = effectsRecord(undefined, false);
        const runtime = createLedgerReadRuntime();
        let revision = '1';
        let complete!: () => void;
        let started!: () => void;
        const pending = new Promise<void>(resolve => { started = resolve; });
        const gateway = createDisplayReadGateway({
          runtime, getAccountRevision: () => revision,
          gateway: {
            loadAccountBalances: jest.fn(),
            loadAccountOperations: async () => ({ status: 'active', address: effectsSource, records: [raw] }),
            loadOperation: async () => ({ status: 'found', record: raw }),
            loadOperationEffects: async () => {
              started();
              await new Promise<void>(resolve => { complete = resolve; });
              return effectsProof();
            },
          },
        });
        const dependencies = { gateway, networkId: 'test' };
        const request = path === 'page' ? loadHistoryPage(dependencies, lifecycleAccount) : loadHistoryOperationDetails(dependencies, lifecycleAccount, raw.id);
        const outcome = request.then(() => undefined, (error: unknown) => error);
        await pending;
        if (change === 'revision') revision = '2';
        else runtime.update({ foreground: change !== 'background', connectivity: change === 'offline' ? 'offline' : 'unknown' });
        if (timeout) await jest.advanceTimersByTimeAsync(6000);
        else complete();
        expect(await outcome).toEqual(new Error('ledger-read-superseded'));
        complete();
      }
    }
  } finally {
    jest.useRealTimers();
  }
});
