import { mapHistoryEntry } from '../loadHistoryPage';
import { normalizeHistoryCacheSnapshot } from '../HistoryCacheRepository';
import { loadHistoryOperationDetails } from '../loadHistoryOperationDetails';
import { isTechnicalHistoryOperation } from '../failedHistory';
import type { HistoryEntry } from '../types';
import type { AccountRecord } from '../../account/types';
import {
  controlSource as source,
  controlPeer as peer,
  controlForeign as foreign,
  controlRecord,
} from './classicControlHistory.fixtures';
const types = [
  'payment',
  'create_account',
  'change_trust',
  'path_payment_strict_send',
  'path_payment_strict_receive',
  'manage_buy_offer',
  'manage_sell_offer',
  'create_passive_sell_offer',
  'liquidity_pool_deposit',
  'liquidity_pool_withdraw',
  'create_claimable_balance',
  'claim_claimable_balance',
  'clawback',
  'clawback_claimable_balance',
  'invoke_host_function',
  'extend_footprint_ttl',
  'restore_footprint',
  'bump_sequence',
  'allow_trust',
  'set_trust_line_flags',
  'begin_sponsoring_future_reserves',
  'end_sponsoring_future_reserves',
  'manage_data',
  'account_merge',
  'set_options',
  'revoke_sponsorship',
  'inflation',
  'future_unknown',
];
function cache(entry: HistoryEntry, accountAddress = source) {
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
it.each(types)('renders known failed %s as non-monetary attempted operation, not its success family', type => {
  const entry = mapHistoryEntry(
    controlRecord(type, {}, { successful: false, amount: '999', sourceAmount: '888', to: peer }),
    source,
  );
  expect(entry).toMatchObject({ kind: 'failed', successful: false });
  for (const field of ['amount', 'sourceAmount', 'asset', 'parameters', 'events', 'direction'])
    expect(entry).not.toHaveProperty(field);
  expect(cache(entry).entries[0]).toEqual(entry);
  expect(cache(entry).details[0].entry).toEqual(entry);
  expect(() => cache(entry, foreign)).toThrow();
  expect(() =>
    normalizeHistoryCacheSnapshot({
      schemaVersion: 1,
      lastSuccessfulHorizonUpdateAt: new Date(),
      entries: [entry],
      details: [],
    }),
  ).toThrow();
  expect(Object.isFrozen(cache(entry).entries[0])).toBe(true);
  expect(() => cache({ ...entry, successful: true } as unknown as HistoryEntry)).toThrow();
});
it('binds failed payment recipients while rejecting unrelated injected parties and cache contamination', async () => {
  const record = controlRecord('payment', {}, { successful: false, to: peer, account: foreign });
  const entry = mapHistoryEntry(record, peer);
  expect(entry).toMatchObject({ kind: 'failed', relatedAccounts: [source, peer] });
  expect(cache(entry, peer).entries[0]).toEqual(entry);
  const dirty = { ...entry, amount: '999', relatedAccounts: [source, peer] } as unknown as HistoryEntry;
  expect(cache(dirty, peer).entries[0]).toEqual(entry);
  const dependencies = {
    networkId: 'test',
    gateway: { loadOperation: async () => ({ status: 'found' as const, record }), loadAccountOperations: jest.fn() },
  };
  const account = (address: string) => ({ networkId: 'test', address, identityKind: 'classic' }) as AccountRecord;
  expect(await loadHistoryOperationDetails(dependencies, account(peer), 'payment')).toMatchObject({
    status: 'ready',
    entry: { kind: 'failed' },
  });
  expect(await loadHistoryOperationDetails(dependencies, account(foreign), 'payment')).toEqual({
    status: 'not-associated',
  });
  expect(() => cache({ ...entry, relatedAccounts: [peer] } as HistoryEntry, peer)).toThrow();
  expect(() => cache({ ...entry, relatedAccounts: [source, source] } as HistoryEntry)).toThrow();
});
it('classifies only explicit technical operations and preserves unknown/financial entries', () => {
  expect(isTechnicalHistoryOperation('manage_data')).toBe(true);
  for (const type of ['payment', 'account_merge', 'future_unknown', 'invoke_host_function'])
    expect(isTechnicalHistoryOperation(type)).toBe(false);
});
