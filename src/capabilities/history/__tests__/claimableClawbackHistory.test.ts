import { normalizeClaimPredicate } from '../claimableClawbackHistory';
import { mapHistoryEntry } from '../loadHistoryPage';
import { loadHistoryOperationDetails } from '../loadHistoryOperationDetails';
import { normalizeHistoryCacheSnapshot } from '../HistoryCacheRepository';
import type { HistoryOperationRecord } from '../HistoryGateway';
import type { HistoryEntry } from '../types';
import type { AccountRecord } from '../../account/types';

const creator = `G${'A'.repeat(55)}`;

const claimant = `G${'B'.repeat(55)}`;

const issuer = `G${'C'.repeat(55)}`;

const foreign = `G${'D'.repeat(55)}`;

const balanceId = `00000000${'a'.repeat(64)}`;

const account = (address: string) => ({ address, networkId: 'test', identityKind: 'classic' }) as AccountRecord;

function raw(type = 'create_claimable_balance'): HistoryOperationRecord {
  return {
    id: '123',
    pagingToken: '123',
    type,
    occurredAt: '2026-11-03T00:00:00Z',
    transactionHash: 'hash',
    sourceAccount: creator,
    successful: true,
    asset: { kind: 'native' },
    amount: '922337203685.4775807',
    claimants: [{ destination: claimant, predicate: { unconditional: true } }],
    balanceId,
    claimant: creator,
  };
}

function snapshot(entry: HistoryEntry, address = creator) {
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

it.each([
  { successful: undefined },
  { successful: 'true' },
  { sourceAccount: ` ${creator}` },
  { amount: '0' },
  { amount: '922337203685.4775808' },
  { amount: '1.00000001' },
  { amount: '-1' },
  { asset: { kind: 'credit', code: 'bad:code', issuer } },
  { asset: { kind: 'credit', code: 'USD', issuer: 'invalid' } },
  { claimants: [] },
  { claimants: Array.from({ length: 11 }, () => ({ destination: claimant, predicate: { unconditional: true } })) },
  { claimants: [{ destination: 'invalid', predicate: { unconditional: true } }] },
  { claimants: [{ destination: claimant, predicate: { unconditional: true, unknown: true } }] },
])('rejects malformed create evidence %j', patch => {
  expect(mapHistoryEntry({ ...raw(), ...patch } as HistoryOperationRecord, creator)).toMatchObject({
    kind: 'unsupported',
    reason: 'operation-shape',
  });
});

it.each(['A'.repeat(72), 'a'.repeat(64), `00000001${'a'.repeat(64)}`, `${balanceId} `])(
  'rejects malformed reference ID %s',
  value => {
    expect(mapHistoryEntry({ ...raw('claim_claimable_balance'), balanceId: value }, creator).kind).toBe('unsupported');
  },
);

it.each([{ claimant }, { sourceAccount: issuer }])('rejects mismatched claim actor %j', patch => {
  expect(mapHistoryEntry({ ...raw('claim_claimable_balance'), ...patch }, creator).kind).toBe('unsupported');
});

it.each([
  { sourceAccount: creator },
  { from: issuer },
  { from: undefined },
  { fromMuxed: 'invalid' },
  { amount: '-1' },
  { asset: { kind: 'native' } },
])('rejects malformed clawback roles %j', patch => {
  expect(
    mapHistoryEntry(
      {
        ...raw('clawback'),
        sourceAccount: issuer,
        from: creator,
        asset: { kind: 'credit', code: 'USD', issuer },
        ...patch,
      } as HistoryOperationRecord,
      creator,
    ).kind,
  ).toBe('unsupported');
});

it.each([
  {},
  { unconditional: false },
  { unconditional: true, rel_before: '1' },
  { and: [{ unconditional: true }] },
  { or: [null, { unconditional: true }] },
  { absBefore: 'bad' },
  { abs_before: '+39121901036-99-99T99:99:99Z' },
  { abs_before: '2026-01-01T00:00:00Z', absBefore: '2027-01-01T00:00:00Z' },
  { rel_before: '1', relBefore: '2' },
  { abs_before_epoch: '9223372036854775808' },
  { rel_before: '1.2' },
])('rejects malformed or conflicting condition %j', value => expect(normalizeClaimPredicate(value)).toBeUndefined());

it('bounds recursion including cyclic runtime objects', () => {
  let predicate: unknown = { unconditional: true };
  for (let i = 0; i < 4; i++) predicate = { not: predicate };
  expect(normalizeClaimPredicate(predicate)).toBeDefined();
  expect(normalizeClaimPredicate({ not: predicate })).toBeUndefined();
  const cycle: { not?: unknown } = {};
  cycle.not = cycle;
  expect(normalizeClaimPredicate(cycle)).toBeUndefined();
});

it.each(['create_claimable_balance', 'claim_claimable_balance', 'clawback', 'clawback_claimable_balance'])(
  'rejects foreign detail %s despite injected participants',
  async type => {
    const record = {
      ...raw(type),
      ...(type === 'clawback'
        ? { sourceAccount: issuer, from: creator, asset: { kind: 'credit' as const, code: 'USD', issuer } }
        : {}),
      to: foreign,
      account: foreign,
      funder: foreign,
    };
    const gateway = {
      loadOperation: async () => ({ status: 'found' as const, record }),
      loadAccountOperations: jest.fn(),
    };
    expect(await loadHistoryOperationDetails({ networkId: 'test', gateway }, account(foreign), record.id)).toEqual({
      status: 'not-associated',
    });
  },
);

it('strips unknown owned cache fields and rejects partition, native code, role, family and detail mismatches', () => {
  const entry = mapHistoryEntry(raw(), creator);
  if (entry.kind !== 'claimable-create') throw new Error('wrong-kind');
  const dirty = {
    ...entry,
    extra: 'secret',
    asset: { ...entry.asset, extra: 'other' },
    claimants: entry.claimants.map(c => ({ ...c, extra: 'other' })),
  };
  const normalized = snapshot(dirty).entries[0];
  expect(normalized).toEqual(entry);
  expect(Object.isFrozen(normalized)).toBe(true);
  if (normalized.kind !== 'claimable-create') throw new Error('wrong-kind');
  expect(Object.isFrozen(normalized.claimants)).toBe(true);
  expect(Object.isFrozen(normalized.claimants[0].predicate)).toBe(true);
  expect(() => snapshot(entry, foreign)).toThrow('history-cache-invalid-entry');
  expect(() => snapshot({ ...entry, role: 'claimant' as const })).toThrow('history-cache-invalid-entry');
  expect(() => snapshot({ ...entry, asset: { kind: 'native', code: 'USD' } } as unknown as HistoryEntry)).toThrow();
  expect(() => snapshot({ ...entry, operationType: 'clawback_claimable_balance' })).toThrow();
  const legacy = { ...entry, kind: 'unsupported', reason: 'operation-type' } as HistoryEntry;
  expect(snapshot(legacy).entries[0].kind).toBe('unsupported');
  const malformed = mapHistoryEntry({ ...raw(), successful: false }, creator);
  expect(snapshot(malformed).entries[0]).toEqual(malformed);
  expect(() =>
    normalizeHistoryCacheSnapshot(
      {
        schemaVersion: 1,
        lastSuccessfulHorizonUpdateAt: new Date(),
        entries: [entry],
        details: [{ operationId: entry.id, entry: { ...entry, amount: '2' } }],
      },
      { networkId: 'test', accountAddress: creator },
    ),
  ).toThrow('history-cache-detail-mismatch');
});

it.each(['issuer', 'holder'])(
  'rejects missing persisted clawback holder display in %s partition instead of repairing an identity',
  role => {
    const address = role === 'issuer' ? issuer : creator;
    const entry = mapHistoryEntry(
      {
        ...raw('clawback'),
        sourceAccount: issuer,
        from: creator,
        fromMuxed: `M${'A'.repeat(68)}`,
        asset: { kind: 'credit', code: 'USD', issuer },
      },
      address,
    );
    if (entry.kind !== 'clawback') throw new Error('expected-clawback');
    expect(snapshot(entry, address).entries[0]).toEqual(entry);
    expect(() => snapshot({ ...entry, holder: undefined } as unknown as HistoryEntry, address)).toThrow(
      'history-cache-invalid-entry',
    );
  },
);

it('keeps explicit claimant detail navigable as unsupported when its historical predicate is malformed', async () => {
  const record = { ...raw(), claimants: [{ destination: claimant, predicate: { unknown: true } }], to: foreign };
  const dependencies = {
    networkId: 'test',
    gateway: {
      loadOperation: async () => ({ status: 'found' as const, record }),
      loadAccountOperations: jest.fn(),
    },
  };
  expect(mapHistoryEntry(record, claimant)).toMatchObject({ kind: 'unsupported', reason: 'operation-shape' });
  expect(await loadHistoryOperationDetails(dependencies, account(claimant), record.id)).toMatchObject({
    status: 'ready',
    entry: { kind: 'unsupported', reason: 'operation-shape' },
  });
  expect(await loadHistoryOperationDetails(dependencies, account(foreign), record.id)).toEqual({
    status: 'not-associated',
  });
});
