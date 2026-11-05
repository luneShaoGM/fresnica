import { effectsRecord, effectsProof, effectsSource, effectsPeer } from './claimableEffects.fixtures';
import { mapHistoryEntry } from '../loadHistoryPage';
import { normalizeHistoryCacheSnapshot } from '../HistoryCacheRepository';
import { enrichClaimableRecords } from '../claimableEffects';
import type { HistoryEntry } from '../types';
const partition = { networkId: 'test', accountAddress: effectsSource };
function cache(entry: HistoryEntry) {
  return normalizeHistoryCacheSnapshot(
    {
      schemaVersion: 1,
      lastSuccessfulHorizonUpdateAt: new Date(),
      entries: [entry],
      details: [{ operationId: entry.id, entry }],
    },
    partition,
  );
}
it.each(['claim_claimable_balance', 'clawback_claimable_balance'])(
  'binds verified %s asset/quantity to operation/balance/account and exact cache evidence',
  type => {
    const entry = mapHistoryEntry(effectsRecord(type), effectsSource);
    expect(entry).toMatchObject({
      kind: 'claimable-reference',
      amount: '922337203685.4775807',
      evidence: { operationId: type, complete: true },
    });
    expect(cache(entry).entries[0]).toEqual(entry);
    expect(cache(entry).details[0].entry).toEqual(entry);
    if (entry.kind !== 'claimable-reference') throw new Error('fixture');
    expect(Object.isFrozen(entry.evidence?.records[0])).toBe(true);
    expect(() => cache({ ...entry, amount: '2' })).toThrow();
    expect(() => cache({ ...entry, evidence: undefined })).toThrow();
    expect(() =>
      cache({ ...entry, evidence: { ...entry.evidence!, complete: false } } as unknown as HistoryEntry),
    ).toThrow();
  },
);
it.each([
  'partial',
  'wrong-operation',
  'wrong-balance',
  'wrong-account',
  'duplicate',
  'sparse',
  'conflict',
  'invalid-amount',
])('keeps unavailable quantity for %s effect evidence', mutation => {
  const original = effectsProof();
  const proof = { ...original, records: original.records.slice() };
  if (mutation === 'partial') proof.complete = false;
  if (mutation === 'wrong-operation') proof.operationId = 'foreign';
  if (mutation === 'wrong-balance') proof.records[0] = { ...proof.records[0], balanceId: `00000000${'b'.repeat(64)}` };
  if (mutation === 'wrong-account') proof.records[1] = { ...proof.records[1], account: effectsPeer };
  if (mutation === 'duplicate') proof.records.push(proof.records[1]);
  if (mutation === 'sparse') {
    proof.records.length = 3;
  }
  if (mutation === 'conflict') proof.records[0] = { ...proof.records[0], amount: '2' };
  if (mutation === 'invalid-amount') proof.records[1] = { ...proof.records[1], amount: '922337203685.4775808' };
  const entry = mapHistoryEntry({ ...effectsRecord(), claimableEffects: proof }, effectsSource);
  expect(entry).toMatchObject({ kind: 'claimable-reference' });
  expect(entry).not.toHaveProperty('amount');
  expect(entry).not.toHaveProperty('asset');
});
it('never enriches issuer burn as native funds or another issuer asset', () => {
  const proof = effectsProof('clawback_claimable_balance');
  for (const asset of [{ kind: 'native' as const }, { kind: 'credit' as const, code: 'USD', issuer: effectsPeer }]) {
    const entry = mapHistoryEntry(
      {
        ...effectsRecord('clawback_claimable_balance'),
        claimableEffects: { ...proof, records: [proof.records[0], { ...proof.records[1], asset }] },
      },
      effectsSource,
    );
    expect(entry).not.toHaveProperty('amount');
  }
});
it('bounds metadata latency and cannot mutate returned records with a late proof', async () => {
  jest.useFakeTimers();
  let complete: ((proof: ReturnType<typeof effectsProof>) => void) | undefined;
  const loadOperationEffects = jest.fn(
    () =>
      new Promise<ReturnType<typeof effectsProof>>(resolve => {
        complete = resolve;
      }),
  );
  const raw = effectsRecord(undefined, false);
  try {
    const request = enrichClaimableRecords(
      { loadOperationEffects, loadOperation: jest.fn(), loadAccountOperations: jest.fn() },
      [raw],
      effectsSource,
    );
    await jest.advanceTimersByTimeAsync(6000);
    const result = await request;
    expect(loadOperationEffects.mock.calls.length).toBe(1);
    expect(result[0]).toBe(raw);
    complete?.(effectsProof());
    await Promise.resolve();
    await Promise.resolve();
    expect(result[0]).toBe(raw);
  } finally {
    jest.useRealTimers();
  }
});
it('limits enrichment to four concurrent operation reads while covering the whole loaded page', async () => {
  const pending: { id: string; resolve: (proof: ReturnType<typeof effectsProof>) => void }[] = [];
  const loadOperationEffects = jest.fn((input: { operationId: string }) => new Promise<ReturnType<typeof effectsProof>>(resolve => pending.push({ id: input.operationId, resolve })));
  const records = Array.from({ length: 5 }, (_, index) => ({ ...effectsRecord(undefined, false), id: String(index), pagingToken: String(index) }));
  const request = enrichClaimableRecords({ loadOperationEffects, loadOperation: jest.fn(), loadAccountOperations: jest.fn() }, records, effectsSource);
  expect(pending.length).toBe(4);
  pending[0].resolve({ ...effectsProof(), operationId: pending[0].id });
  await Promise.resolve(); await Promise.resolve();
  expect(pending.length).toBe(5);
  for (const item of pending.slice(1)) item.resolve({ ...effectsProof(), operationId: item.id });
  const result = await request;
  expect(result.every(record => record.claimableEffects?.complete === true)).toBe(true);
});
