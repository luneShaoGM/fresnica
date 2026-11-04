import { mapHistoryEntry } from '../loadHistoryPage';
import { loadHistoryOperationDetails } from '../loadHistoryOperationDetails';
import { normalizeHistoryCacheSnapshot } from '../HistoryCacheRepository';
import type { HistoryEntry } from '../types';
import type { AccountRecord } from '../../account/types';
import {
  maintenanceRecord,
  maintenanceSource,
  maintenanceForeign,
  maintenanceTypes,
} from './maintenanceHistory.fixtures';

function cache(entry: HistoryEntry, address = maintenanceSource) {
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
it.each(maintenanceTypes)('normalizes only owned %s parameters and strips injected money', type => {
  const entry = mapHistoryEntry(maintenanceRecord(type, { amount: '99', to: maintenanceForeign }), maintenanceSource);
  expect(entry).toMatchObject({ kind: 'maintenance', successful: true });
  expect(entry).not.toHaveProperty('amount');
  expect(entry).not.toHaveProperty('to');
  expect('extendTo' in entry).toBe(type === 'extend_footprint_ttl');
  expect('bumpTo' in entry).toBe(type === 'bump_sequence');
  expect(cache(entry).entries[0]).toEqual(entry);
  expect(Object.isFrozen(cache(entry).entries[0])).toBe(true);
  expect(() => cache(entry, maintenanceForeign)).toThrow();
  const dirty = { ...entry, amount: '999', parameters: ['discard'] } as unknown as HistoryEntry;
  expect(cache(dirty).entries[0]).toEqual(entry);
  expect(() => cache({ ...entry, successful: false } as unknown as HistoryEntry)).toThrow();
  expect(() => cache({ ...entry, operationType: 'payment' })).toThrow();
  expect(cache({ ...entry, kind: 'unsupported', reason: 'operation-type' } as HistoryEntry).entries[0]).toMatchObject({
    kind: 'unsupported',
  });
});
it.each([undefined, null, '1', -1, 0.1, 4294967296, NaN, Infinity])('rejects invalid extension %s', extendTo => {
  expect(mapHistoryEntry(maintenanceRecord('extend_footprint_ttl', { extendTo }), maintenanceSource)).toMatchObject({
    kind: 'unsupported',
    reason: 'operation-shape',
  });
});
it.each([undefined, null, 1, '-1', '+1', '01', '1.0', '1e3', ' 1', '9223372036854775808'])(
  'rejects invalid target %s',
  bumpTo => {
    expect(mapHistoryEntry(maintenanceRecord('bump_sequence', { bumpTo }), maintenanceSource)).toMatchObject({
      kind: 'unsupported',
      reason: 'operation-shape',
    });
  },
);
it('preserves zero and maximum values exactly and does not adopt the old TTL type', () => {
  expect(mapHistoryEntry(maintenanceRecord('extend_footprint_ttl', { extendTo: 0 }), maintenanceSource)).toMatchObject({
    extendTo: 0,
  });
  expect(mapHistoryEntry(maintenanceRecord('bump_sequence', { bumpTo: '0' }), maintenanceSource)).toMatchObject({
    bumpTo: '0',
  });
  expect(mapHistoryEntry(maintenanceRecord('bump_sequence'), maintenanceSource)).toMatchObject({
    bumpTo: '9223372036854775807',
  });
  expect(mapHistoryEntry(maintenanceRecord('bump_footprint_expiration'), maintenanceSource)).toMatchObject({
    kind: 'unsupported',
    reason: 'operation-type',
  });
});
it.each(maintenanceTypes)('requires literal success and source-only association for %s', async type => {
  for (const successful of [undefined])
    expect(mapHistoryEntry(maintenanceRecord(type, { successful }), maintenanceSource)).toMatchObject({
      kind: 'unsupported',
    });
  const record = maintenanceRecord(type, {
    to: maintenanceForeign,
    from: maintenanceForeign,
    account: maintenanceForeign,
    extendTo: 'bad',
    bumpTo: 'bad',
    dataName: '',
  });
  const dependencies = {
    networkId: 'test',
    gateway: { loadOperation: async () => ({ status: 'found' as const, record }), loadAccountOperations: jest.fn() },
  };
  const account = (address: string) => ({ networkId: 'test', identityKind: 'classic', address }) as AccountRecord;
  expect(await loadHistoryOperationDetails(dependencies, account(maintenanceForeign), type)).toEqual({
    status: 'not-associated',
  });
  expect(await loadHistoryOperationDetails(dependencies, account(maintenanceSource), type)).toMatchObject({
    status: 'ready',
    entry: { kind: type === 'restore_footprint' ? 'maintenance' : 'unsupported' },
  });
  expect(
    mapHistoryEntry(maintenanceRecord(type, { sourceAccount: ` ${maintenanceSource}` }), maintenanceSource),
  ).toMatchObject({ kind: 'unsupported' });
});

it.each(['a', ' ', 'a'.repeat(64), '界'.repeat(21) + 'a', '😀'.repeat(16), ' key '])(
  'preserves bounded account data name %j without normalizing it', dataName => {
    const entry = mapHistoryEntry(maintenanceRecord('manage_data', { dataName }), maintenanceSource);
    expect(entry).toMatchObject({ kind: 'maintenance', dataName });
    const normalized = cache({ ...entry, value: 'NEVER-SAVE', amount: '9', extendTo: 5 } as unknown as HistoryEntry);
    expect(normalized.entries[0]).toEqual(entry);
    expect(normalized.details[0].entry).toEqual(entry);
    expect(Object.isFrozen(normalized.entries[0])).toBe(true);
    expect(() => cache({ ...entry, dataName: undefined } as unknown as HistoryEntry)).toThrow();
    expect(() => cache({ ...entry, dataName: 'a'.repeat(65) } as unknown as HistoryEntry)).toThrow();
  },
);
it.each([undefined, null, 3, {}, '', 'a'.repeat(65), '界'.repeat(22), '😀'.repeat(17), '\ud800', '\udc00', 'a\n', '\u0000', '\u0085'])(
  'rejects malformed account data name %j', dataName => {
    const entry = mapHistoryEntry(maintenanceRecord('manage_data', { dataName }), maintenanceSource);
    expect(entry).toMatchObject({ kind: 'unsupported', reason: 'operation-shape' });
    expect(cache(entry).entries[0]).toEqual(entry);
  },
);
