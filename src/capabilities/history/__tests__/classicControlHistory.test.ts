import { mapHistoryEntry } from '../loadHistoryPage';
import { normalizeHistoryCacheSnapshot } from '../HistoryCacheRepository';
import { loadHistoryOperationDetails } from '../loadHistoryOperationDetails';
import type { HistoryEntry } from '../types';
import type { AccountRecord } from '../../account/types';
import {
  controlCases,
  controlRecord,
  controlSource,
  controlPeer,
  controlForeign,
} from './classicControlHistory.fixtures';
function cache(entry: HistoryEntry, accountAddress = controlSource) {
  return normalizeHistoryCacheSnapshot(
    {
      schemaVersion: 1,
      lastSuccessfulHorizonUpdateAt: new Date(),
      entries: [entry],
      details: [{ operationId: entry.id, entry }],
    },
    { networkId: 'test', accountAddress },
  );
}
it.each(controlCases)('normalizes %s target %j and reconstructs owned partitioned cache', (type, parameters) => {
  const entry = mapHistoryEntry(controlRecord(type, parameters), controlSource);
  expect(entry).toMatchObject({ kind: 'account-control', parameters });
  expect(cache(entry).entries[0]).toEqual(entry);
  expect(cache(entry).details[0].entry).toEqual(entry);
  expect(Object.isFrozen(cache(entry).entries[0])).toBe(true);
  expect(() => cache(entry, controlForeign)).toThrow();
  expect(() => cache({ ...entry, successful: false } as unknown as HistoryEntry)).toThrow();
  const dirty = { ...entry, amount: '9', parameters: { ...parameters, secret: 'discard' } } as unknown as HistoryEntry;
  expect(cache(dirty).entries[0]).toEqual(entry);
  expect(cache({ ...entry, kind: 'unsupported', reason: 'operation-type' } as HistoryEntry).entries[0]).toMatchObject({
    kind: 'unsupported',
  });
  expect(mapHistoryEntry(controlRecord(type, parameters, { successful: false }), controlSource)).toMatchObject({
    kind: 'failed',
  });
});
it.each([
  ['account_merge', { account: controlPeer, into: controlPeer }],
  ['account_merge', { account: controlSource, into: controlSource }],
  ['set_options', { signer_key: controlPeer }],
  ['set_options', { signer_weight: 0 }],
  ['set_options', { master_key_weight: 256 }],
  ['set_options', { low_threshold: '1' }],
  ['set_options', { set_flags: [1, 1] }],
  ['set_options', { set_flags: [16] }],
  ['set_options', { set_flags: [1], clear_flags: [1] }],
  ['set_options', { set_flags: Object.assign(Array(2), { 1: 1 }) }],
  ['set_options', { home_domain: '界'.repeat(11) }],
  ['set_options', { home_domain: '\ud800' }],
  ['revoke_sponsorship', {}],
  ['revoke_sponsorship', { account_id: controlPeer, offer_id: '1' }],
  ['revoke_sponsorship', { offer_id: 1 }],
  ['revoke_sponsorship', { offer_id: '9223372036854775808' }],
  ['revoke_sponsorship', { data_account_id: controlPeer }],
  ['revoke_sponsorship', { trustline_account_id: controlPeer, trustline_asset: 'native' }],
])('fails closed malformed %s %j', (type, parameters) => {
  const entry = mapHistoryEntry(controlRecord(type, parameters), controlSource);
  expect(entry).toMatchObject({ kind: 'unsupported', reason: 'operation-shape' });
  expect(cache(entry).entries[0]).toEqual(entry);
});
it('associates only the actual merge parties or explicit revocation owner', async () => {
  for (const [type, parameters] of controlCases) {
    const record = controlRecord(type, parameters, { to: controlForeign, from: controlForeign });
    const dependencies = {
      networkId: 'test',
      gateway: { loadOperation: async () => ({ status: 'found' as const, record }), loadAccountOperations: jest.fn() },
    };
    const account = (address: string) => ({ networkId: 'test', address, identityKind: 'classic' }) as AccountRecord;
    expect(await loadHistoryOperationDetails(dependencies, account(controlForeign), type)).toEqual({
      status: 'not-associated',
    });
    expect(await loadHistoryOperationDetails(dependencies, account(controlSource), type)).toMatchObject({
      status: 'ready',
      entry: { kind: 'account-control' },
    });
  }
  const entry = mapHistoryEntry(
    controlRecord('account_merge', { account: controlSource, into: controlPeer }),
    controlPeer,
  );
  expect(entry).toMatchObject({ counterparty: controlSource });
  expect(cache(entry, controlPeer).entries[0]).toEqual(entry);
  expect(() => cache({ ...entry, counterparty: controlForeign } as HistoryEntry, controlPeer)).toThrow();
});
it.each([69, 165])('keeps bounded P display shape of length %s in cache', length => {
  const signer_key = `P${'A'.repeat(length - 1)}`;
  const entry = mapHistoryEntry(controlRecord('set_options', { signer_key, signer_weight: 0 }), controlSource);
  expect(entry).toMatchObject({ kind: 'account-control' });
  expect(cache(entry).entries[0]).toEqual(entry);
});
it.each([
  `P${'A'.repeat(67)}`,
  `P${'A'.repeat(69)}`,
  `P${'A'.repeat(165)}`,
  `P${'a'.repeat(68)}`,
  `P${'1'.repeat(68)}`,
])('rejects invalid P shape %s', signer_key => {
  expect(mapHistoryEntry(controlRecord('set_options', { signer_key, signer_weight: 0 }), controlSource)).toMatchObject({
    kind: 'unsupported',
  });
});
