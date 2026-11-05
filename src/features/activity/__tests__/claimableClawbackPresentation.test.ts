import { normalizeClaimPredicate } from '../../../capabilities/history/claimableClawbackHistory';
import { mapHistoryEntry } from '../../../capabilities/history/loadHistoryPage';
import { normalizeHistoryCacheSnapshot } from '../../../capabilities/history/HistoryCacheRepository';
import type { HistoryOperationRecord } from '../../../capabilities/history/HistoryGateway';
import type { HistoryEntry } from '../../../capabilities/history/types';
import { activityRowPresentation } from '../activityRowPresentation';
import { matchesActivityFilter, matchesActivitySearch } from '../activityList';
import { claimPredicateSummary } from '../claimPredicateSummary';
import { createLocalization } from '../../../locale/localization';

const creator = `G${'A'.repeat(55)}`;

const claimant = `G${'B'.repeat(55)}`;

const issuer = `G${'C'.repeat(55)}`;

const balanceId = `00000000${'a'.repeat(64)}`;

const { t, formatNumber } = createLocalization('en');

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

it('distinguishes escrow funding, claimant conditionality and issuer issuance without false income', () => {
  const native = mapHistoryEntry(raw(), creator);
  const incoming = mapHistoryEntry(raw(), claimant);
  const issued = mapHistoryEntry(
    { ...raw(), sourceAccount: issuer, asset: { kind: 'credit', code: 'XLM', issuer } },
    issuer,
  );
  expect(native).toMatchObject({ kind: 'claimable-create', role: 'funder' });
  expect(activityRowPresentation(native, t, formatNumber).money).toMatchObject({
    amount: '−922,337,203,685.4775807',
    tone: 'negative',
  });
  expect(incoming).toMatchObject({ kind: 'claimable-create', role: 'claimant' });
  expect(activityRowPresentation(incoming, t, formatNumber).money).toBeUndefined();
  expect(issued).toMatchObject({ kind: 'claimable-create', role: 'issuer', asset: { kind: 'credit', code: 'XLM' } });
  expect(activityRowPresentation(issued, t, formatNumber).money).toBeUndefined();
  expect(
    mapHistoryEntry({ ...raw(), claimants: [{ destination: creator, predicate: { unconditional: true } }] }, creator),
  ).toMatchObject({ role: 'funder' });
  expect(mapHistoryEntry({ ...raw(), asset: { kind: 'credit', code: 'USD', issuer } }, issuer)).toMatchObject({
    kind: 'unsupported',
    reason: 'operation-shape',
  });
});

it.each(['claim_claimable_balance', 'clawback_claimable_balance'])(
  'keeps %s balance IDs exact and never fabricates quantity from injected fields',
  type => {
    const entry = mapHistoryEntry(raw(type), creator);
    expect(entry).toMatchObject({ kind: 'claimable-reference', balanceId });
    expect(entry).not.toHaveProperty('amount');
    const row = activityRowPresentation(entry, t, formatNumber);
    expect(row.subject).toEqual({ kind: 'reference', identity: balanceId });
    expect(row.money).toBeUndefined();
    expect(matchesActivitySearch(entry, balanceId, t, formatNumber)).toBe(true);
    expect(snapshot(entry).entries[0]).toEqual(entry);
    expect(() => snapshot({ ...entry, amount: '999', asset: { kind: 'native', code: 'BAD' } } as unknown as HistoryEntry)).toThrow('history-cache-invalid-entry');
  },
);

it('represents removed holder quantity separately from issuer neutral burn, preserving muxed display', () => {
  const record = {
    ...raw('clawback'),
    sourceAccount: issuer,
    from: creator,
    fromMuxed: `M${'A'.repeat(68)}`,
    asset: { kind: 'credit' as const, code: 'USD', issuer },
  };
  const holder = mapHistoryEntry(record, creator);
  const burn = mapHistoryEntry(record, issuer);
  expect(holder).toMatchObject({ kind: 'clawback', role: 'holder', holder: record.fromMuxed, holderBase: creator });
  expect(activityRowPresentation(holder, t, formatNumber).money?.tone).toBe('negative');
  expect(activityRowPresentation(burn, t, formatNumber).money).toBeUndefined();
  expect(snapshot(holder).entries[0]).toEqual(holder);
  expect(
    activityRowPresentation(mapHistoryEntry({ ...record, amount: '0.0000000' }, creator), t, formatNumber).money,
  ).toMatchObject({ amount: '0', tone: 'neutral' });
  expect(matchesActivitySearch(holder, record.fromMuxed, t, formatNumber)).toBe(true);
});

it('retains condition structure, documented aliases and exact huge times without evaluating current eligibility', () => {
  const value = {
    and: [
      { not: { absBefore: '+39121901036-03-29T15:30:22Z', abs_before_epoch: '1234567890123456789' } },
      { relBefore: '9223372036854775807' },
    ],
  };
  const normalized = normalizeClaimPredicate(value)!;
  expect(normalized).toEqual({
    and: [
      { not: { abs_before: '+39121901036-03-29T15:30:22Z', abs_before_epoch: '1234567890123456789' } },
      { rel_before: '9223372036854775807' },
    ],
  });
  expect(claimPredicateSummary(normalized, t)).toContain('+39121901036-03-29T15:30:22Z');
  expect(claimPredicateSummary(normalized, t)).toContain('Both conditions');
  expect(normalizeClaimPredicate({ absBeforeEpoch: '-9223372036854775808' })).toEqual({
    abs_before_epoch: '-9223372036854775808',
  });
  expect(normalizeClaimPredicate({ rel_before: '-1' })).toEqual({ rel_before: '-1' });
  expect(Object.isFrozen(normalized)).toBe(true);
});

it('searches localized conditions and full issued asset identity in the loaded Other set', () => {
  const entry = mapHistoryEntry({ ...raw(), asset: { kind: 'credit', code: 'USD', issuer } }, creator);
  expect(matchesActivityFilter(entry, 'other')).toBe(true);
  expect(matchesActivityFilter(entry, 'payments')).toBe(false);
  for (const query of [claimant, '922,337,203,685.4775807', 'No additional condition', `USD:${issuer}`])
    expect(matchesActivitySearch(entry, query, t, formatNumber)).toBe(true);
});
