import { isDustHistory, isNormallyHiddenHistory } from '../historyDisplayVisibility';
import type { HistoryEntry } from '../types';
const account = 'GSELF';
const native = { kind: 'native', code: 'XLM' };
function row(changes: object = {}): HistoryEntry {
  return {
    id: '1',
    pagingToken: '1',
    occurredAt: '2026-11-09T00:00:00Z',
    transactionHash: 'tx',
    sourceAccount: 'GOTHER',
    kind: 'payment',
    successful: true,
    operationType: 'payment',
    direction: 'incoming',
    asset: native,
    amount: '0.1',
    ...changes,
  } as HistoryEntry;
}
it('hides only verified received native amounts at the exact 0.1 boundary', () => {
  for (const amount of ['0.0000001', '0.1000000', '000.1'])
    expect(isDustHistory(row({ amount }))).toBe(true);
  for (const amount of ['0', '-0.1', '0.1000001', '0.10000000', '1e-7', 'NaN', '922337203685.4775808'])
    expect(isDustHistory(row({ amount }))).toBe(false);
  for (const changes of [
    { successful: false, kind: 'failed' },
    { successful: undefined },
    { direction: 'outgoing' },
    { direction: 'neutral' },
    { asset: { kind: 'credit', code: 'XLM', issuer: 'GISSUER' } },
    { kind: 'create-account', operationType: 'create_account', startingBalance: '0.1' },
  ])
    expect(isDustHistory(row(changes))).toBe(false);
  expect(isDustHistory(row({ direction: 'self' }))).toBe(true);
});
it('uses the destination leg for received or self paths, never the source quantity', () => {
  const path = {
    kind: 'path-payment',
    operationType: 'path_payment_strict_send',
    sourceAmount: '900',
    sourceAsset: { kind: 'credit', code: 'USD', issuer: 'GISSUER' },
    destinationAmount: '0.1',
    destinationAsset: native,
  };
  expect(isDustHistory(row(path))).toBe(true);
  expect(isDustHistory(row({ ...path, direction: 'self' }))).toBe(true);
  expect(isDustHistory(row({ ...path, direction: 'outgoing' }))).toBe(false);
  expect(
    isDustHistory(row({ ...path, destinationAmount: '0.1000001', sourceAmount: '0.0000001' })),
  ).toBe(false);
});
it('uses the explicit seven technical types and preserves direct trust control and unknown records', () => {
  for (const operationType of [
    'manage_data',
    'bump_sequence',
    'begin_sponsoring_future_reserves',
    'end_sponsoring_future_reserves',
    'revoke_sponsorship',
    'extend_footprint_ttl',
    'restore_footprint',
  ]) {
    expect(isNormallyHiddenHistory(row({ kind: 'maintenance', operationType }), account)).toBe(true);
    expect(isNormallyHiddenHistory(row({ kind: 'failed', successful: false, operationType }), account)).toBe(false);
    expect(isNormallyHiddenHistory(row({ kind: 'unsupported', operationType }), account)).toBe(false);
  }
  for (const operationType of ['set_options', 'inflation', 'unknown'])
    expect(isNormallyHiddenHistory(row({ kind: 'account-control', operationType }), account)).toBe(false);
  for (const kind of ['trust-authorization', 'trust-flags']) {
    expect(isNormallyHiddenHistory(row({ kind, trustor: 'GTHIRD' }), account)).toBe(true);
    expect(isNormallyHiddenHistory(row({ kind, trustor: account }), account)).toBe(false);
    expect(isNormallyHiddenHistory(row({ kind, sourceAccount: account }), account)).toBe(false);
  }
});
