import { mapHistoryEntry } from '../loadHistoryPage';
import { loadHistoryOperationDetails } from '../loadHistoryOperationDetails';
import { normalizeHistoryCacheSnapshot } from '../HistoryCacheRepository';
import type { HistoryEntry } from '../types';
import type { AccountRecord } from '../../account/types';
import {
  trustSponsorshipRecord,
  trustSponsorshipTypes,
  trustIssuer,
  trustor,
  trustForeign,
} from './trustSponsorshipHistory.fixtures';

function cache(entry: HistoryEntry, address = trustIssuer) {
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
it.each(trustSponsorshipTypes)(
  'maps %s for both actual parties, rejecting foreign partitions and false success',
  type => {
    for (const address of [trustIssuer, trustor]) {
      const entry = mapHistoryEntry(trustSponsorshipRecord(type, { amount: '999' }), address);
      expect(entry.kind).not.toBe('unsupported');
      expect(entry).not.toHaveProperty('amount');
      expect(cache(entry, address).entries[0]).toEqual(entry);
      expect(Object.isFrozen(entry)).toBe(true);
      expect(() => cache(entry, trustForeign)).toThrow();
      expect(
        cache({ ...entry, kind: 'unsupported', reason: 'operation-type' } as HistoryEntry, address).entries[0],
      ).toMatchObject({ kind: 'unsupported' });
      expect(() => cache({ ...entry, successful: false } as unknown as HistoryEntry, address)).toThrow();
      expect(() => cache({ ...entry, operationType: 'payment' }, address)).toThrow();
    }
    for (const successful of [false, undefined])
      expect(mapHistoryEntry(trustSponsorshipRecord(type, { successful }), trustIssuer)).toMatchObject({
        kind: 'unsupported',
        reason: 'operation-shape',
      });
    expect(
      mapHistoryEntry(trustSponsorshipRecord(type, { sourceAccount: ` ${trustIssuer}` }), trustIssuer),
    ).toMatchObject({ kind: 'unsupported' });
  },
);
it.each([
  [true, false, 'authorized'],
  [false, true, 'maintain-liabilities'],
  [false, false, 'revoked'],
])('preserves authorization %j / %j', (authorize, authorizeToMaintainLiabilities, authorization) => {
  const entry = mapHistoryEntry(
    trustSponsorshipRecord('allow_trust', { authorize, authorizeToMaintainLiabilities }),
    trustor,
  );
  expect(entry).toMatchObject({ kind: 'trust-authorization', authorization });
  expect(cache(entry, trustor).entries[0]).toEqual(entry);
  expect(() => cache({ ...entry, authorization: 'bad' } as unknown as HistoryEntry)).toThrow();
});
it.each([
  { authorize: 1 },
  { authorize: 2 },
  { authorize: null },
  { authorize: undefined },
  { authorizeToMaintainLiabilities: undefined },
  { authorizeToMaintainLiabilities: 'false' },
  { authorize: true, authorizeToMaintainLiabilities: true },
  { trustee: undefined },
  { trustee: trustForeign },
  { trustor: trustIssuer },
  { trustor: 'bad' },
  { asset: { kind: 'native' as const } },
  { asset: { kind: 'credit' as const, code: 'USD', issuer: trustForeign } },
])('rejects invalid authorization %j', overrides => {
  expect(mapHistoryEntry(trustSponsorshipRecord('allow_trust', overrides), trustIssuer)).toMatchObject({
    kind: 'unsupported',
    reason: 'operation-shape',
  });
});
it('keeps empty and clear-only flags, preserving order, ownership and cache canonical arrays', () => {
  const raw = trustSponsorshipRecord('set_trust_line_flags', { setFlags: undefined, clearFlags: [4, 2, 1] });
  const entry = mapHistoryEntry(raw, trustor);
  expect(entry).toMatchObject({ kind: 'trust-flags', setFlags: [], clearFlags: [4, 2, 1] });
  if (entry.kind !== 'trust-flags') throw new Error('fixture');
  (raw.clearFlags as number[]).pop();
  expect(entry.clearFlags).toEqual([4, 2, 1]);
  expect(Object.isFrozen(entry.clearFlags)).toBe(true);
  expect(cache(entry, trustor).entries[0]).toEqual(entry);
  expect(() => cache({ ...entry, setFlags: undefined } as unknown as HistoryEntry)).toThrow();
  expect(() => cache({ ...entry, clearFlags: undefined } as unknown as HistoryEntry)).toThrow();
  expect(
    mapHistoryEntry(
      trustSponsorshipRecord('set_trust_line_flags', { setFlags: undefined, clearFlags: undefined }),
      trustor,
    ),
  ).toMatchObject({ kind: 'trust-flags', setFlags: [], clearFlags: [] });
});
it.each([
  { setFlags: [4], clearFlags: [] },
  { setFlags: [1, 2], clearFlags: [] },
  { setFlags: [1], clearFlags: [1] },
  { setFlags: null },
  { clearFlags: null },
  { setFlags: 0 },
  { setFlags: [1, 1] },
  { clearFlags: [4, 4] },
  { clearFlags: [8] },
  { setFlags: ['1'] },
  { setFlags: [null] },
  { setFlags: new Array(1) },
  { clearFlags: [1, 2, 4, 8] },
  { asset: { kind: 'native' as const } },
  { trustor: trustIssuer },
])('rejects malformed flag instructions %j', overrides => {
  expect(mapHistoryEntry(trustSponsorshipRecord('set_trust_line_flags', overrides), trustIssuer)).toMatchObject({
    kind: 'unsupported',
    reason: 'operation-shape',
  });
});
it.each(['begin_sponsoring_future_reserves', 'end_sponsoring_future_reserves'])(
  'retains sponsor/beneficiary roles for %s, never money',
  type => {
    const source = trustSponsorshipRecord(type).sourceAccount;
    for (const peer of [undefined, null, 'bad', source]) {
      const key = type === 'begin_sponsoring_future_reserves' ? 'sponsoredId' : 'beginSponsor';
      expect(mapHistoryEntry(trustSponsorshipRecord(type, { [key]: peer }), source)).toMatchObject({
        kind: 'unsupported',
        reason: 'operation-shape',
      });
    }
    for (const address of [trustIssuer, trustor]) {
      const entry = mapHistoryEntry(trustSponsorshipRecord(type), address);
      expect(entry).toMatchObject({
        kind: 'sponsorship',
        sponsor: trustIssuer,
        beneficiary: trustor,
        role: address === trustIssuer ? 'sponsor' : 'beneficiary',
      });
      expect(() => cache({ ...entry, role: 'bad' } as unknown as HistoryEntry, address)).toThrow();
      expect(() => cache({ ...entry, sponsor: 'bad' } as unknown as HistoryEntry, address)).toThrow();
      expect(() => cache({ ...entry, beneficiary: 'bad' } as unknown as HistoryEntry, address)).toThrow();
      expect(() =>
        cache(
          {
            ...entry,
            [type === 'begin_sponsoring_future_reserves' ? 'sponsor' : 'beneficiary']: trustForeign,
          } as unknown as HistoryEntry,
          address,
        ),
      ).toThrow();
      expect(cache({ ...entry, amount: '99', memo: 'discard' } as unknown as HistoryEntry, address).entries[0]).toEqual(
        entry,
      );
    }
  },
);
it.each(trustSponsorshipTypes)(
  'uses only actual %s parties for detail, including honest malformed fallback',
  async type => {
    const record = trustSponsorshipRecord(type, { from: trustForeign, to: trustForeign, account: trustForeign });
    const deps = {
      networkId: 'test',
      gateway: { loadOperation: async () => ({ status: 'found' as const, record }), loadAccountOperations: jest.fn() },
    };
    const account = (address: string) => ({ address, identityKind: 'classic', networkId: 'test' }) as AccountRecord;
    expect(await loadHistoryOperationDetails(deps, account(trustForeign), type)).toEqual({ status: 'not-associated' });
    for (const address of [trustIssuer, trustor])
      expect(await loadHistoryOperationDetails(deps, account(address), type)).toMatchObject({ status: 'ready' });
    if (type === 'allow_trust' || type === 'set_trust_line_flags') {
      const bad = { ...record, asset: { kind: 'native' as const } };
      const badDeps = {
        ...deps,
        gateway: { ...deps.gateway, loadOperation: async () => ({ status: 'found' as const, record: bad }) },
      };
      expect(await loadHistoryOperationDetails(badDeps, account(trustor), type)).toMatchObject({
        status: 'ready',
        entry: { kind: 'unsupported' },
      });
    }
  },
);
