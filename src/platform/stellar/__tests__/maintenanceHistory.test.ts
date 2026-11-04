import { createHorizonPublicReadGateway } from '../HorizonPublicReadGateway';
import { mapHistoryOperationRecord } from '../StellarSdkGateway';
import { mapHistoryEntry } from '../../../capabilities/history/loadHistoryPage';
import { normalizeHistoryCacheSnapshot } from '../../../capabilities/history/HistoryCacheRepository';
import {
  maintenanceSource,
  maintenanceTypes,
} from '../../../capabilities/history/__tests__/maintenanceHistory.fixtures';
import { activityRowPresentation } from '../../../features/activity/activityRowPresentation';
import { createLocalization } from '../../../locale/localization';
import type { HorizonOperationLike } from '../types';

function wire(type: string): HorizonOperationLike {
  return {
    id: type,
    paging_token: type,
    type,
    type_i: type === 'extend_footprint_ttl' ? 25 : type === 'restore_footprint' ? 26 : type === 'manage_data' ? 10 : 11,
    transaction_successful: true,
    source_account: maintenanceSource,
    created_at: '2026-11-03T00:00:00Z',
    transaction_hash: 'hash',
    extend_to: 4294967295,
    bump_to: '9223372036854775807',
    name: 'config.memo_required',
    amount: '99',
  };
}
it.each(maintenanceTypes)('projects raw %s through both gateways, cache and row without money', async type => {
  const raw = wire(type);
  const http = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: async () => ({ _embedded: { records: [raw] } }),
  });
  const result = await createHorizonPublicReadGateway(http).loadAccountOperations(
    'https://example.test',
    { address: maintenanceSource, limit: 20 },
    new AbortController().signal,
  );
  if (result.status !== 'active') throw new Error('fixture');
  expect(result.records[0]).toEqual(mapHistoryOperationRecord(raw));
  const entry = mapHistoryEntry(result.records[0], maintenanceSource);
  expect(entry).toMatchObject({ kind: 'maintenance' });
  const snapshot = normalizeHistoryCacheSnapshot(
    {
      schemaVersion: 1,
      lastSuccessfulHorizonUpdateAt: new Date(),
      entries: [entry],
      details: [{ operationId: entry.id, entry }],
    },
    { networkId: 'test', accountAddress: maintenanceSource },
  );
  expect(snapshot.entries[0]).toEqual(entry);
  expect(entry).not.toHaveProperty('amount');
  const { t, formatNumber } = createLocalization('en');
  expect(activityRowPresentation(snapshot.entries[0], t, formatNumber).money).toBeUndefined();
});
it('preserves invalid present parameters for fail-closed mapping and never coerces success', () => {
  const stale = { ...wire('extend_footprint_ttl'), extend_to: undefined, ledgers_to_expire: 100 };
  expect(mapHistoryEntry(mapHistoryOperationRecord(stale), maintenanceSource)).toMatchObject({ kind: 'unsupported' });
  for (const extend_to of [null, '1', 0.5, 4294967296])
    expect(
      mapHistoryEntry(mapHistoryOperationRecord({ ...wire('extend_footprint_ttl'), extend_to }), maintenanceSource),
    ).toMatchObject({ kind: 'unsupported', reason: 'operation-shape' });
  expect(
    mapHistoryEntry(
      mapHistoryOperationRecord({ ...wire('bump_sequence'), bump_to: 9007199254740992 }),
      maintenanceSource,
    ),
  ).toMatchObject({ kind: 'unsupported' });
  for (const type of maintenanceTypes)
    expect(
      mapHistoryEntry(mapHistoryOperationRecord({ ...wire(type), transaction_successful: false }), maintenanceSource),
    ).toMatchObject({ kind: 'unsupported' });
});

it.each([undefined, null, '', 'MQ==', 'not-base64', { secret: 'ignored' }])(
  'keeps manage-data operation-only without decoding or retaining value %j', value => {
    const raw = { ...wire('manage_data'), value };
    const record = mapHistoryOperationRecord(raw);
    expect(record).not.toHaveProperty('value');
    const entry = mapHistoryEntry(record, maintenanceSource);
    expect(entry).toMatchObject({ kind: 'maintenance', dataName: 'config.memo_required' });
    expect(entry).not.toHaveProperty('value');
    for (const name of [null, undefined, 3])
      expect(mapHistoryEntry(mapHistoryOperationRecord({ ...wire('manage_data'), name }), maintenanceSource))
        .toMatchObject({ kind: 'unsupported' });
  },
);
