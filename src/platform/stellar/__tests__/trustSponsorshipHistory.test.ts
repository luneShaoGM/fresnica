import { mapHistoryOperationRecord } from '../StellarSdkGateway';
import { createHorizonPublicReadGateway } from '../HorizonPublicReadGateway';
import { mapHistoryEntry } from '../../../capabilities/history/loadHistoryPage';
import { normalizeHistoryCacheSnapshot } from '../../../capabilities/history/HistoryCacheRepository';
import {
  trustSponsorshipTypes,
  trustIssuer,
  trustor,
} from '../../../capabilities/history/__tests__/trustSponsorshipHistory.fixtures';
import { activityRowPresentation } from '../../../features/activity/activityRowPresentation';
import { createLocalization } from '../../../locale/localization';
import type { HorizonOperationLike } from '../types';

function raw(type: string): HorizonOperationLike {
  return {
    id: type,
    paging_token: type,
    type,
    type_i:
      type === 'allow_trust'
        ? 7
        : type === 'set_trust_line_flags'
          ? 21
          : type === 'begin_sponsoring_future_reserves'
            ? 16
            : 17,
    created_at: '2026-11-03T00:00:00Z',
    transaction_hash: 'hash',
    transaction_successful: true,
    source_account: type === 'end_sponsoring_future_reserves' ? trustor : trustIssuer,
    asset_type: 'credit_alphanum4',
    asset_code: 'USD',
    asset_issuer: trustIssuer,
    trustor,
    trustee: trustIssuer,
    authorize: true,
    authorize_to_maintain_liabilities: true,
    set_flags: [2],
    clear_flags: [1, 4],
    sponsored_id: trustor,
    begin_sponsor: trustIssuer,
    amount: '999',
  };
}
it.each(trustSponsorshipTypes)(
  'projects raw %s through SDK/PublicRead, cache and presentation without payment semantics',
  async type => {
    const wire = raw(type);
    const http = jest
      .fn()
      .mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({ _embedded: { records: [wire] } }),
      });
    const page = await createHorizonPublicReadGateway(http).loadAccountOperations(
      'https://example.test',
      { address: trustIssuer, limit: 20 },
      new AbortController().signal,
    );
    if (page.status !== 'active') throw new Error('fixture');
    expect(page.records[0]).toEqual(mapHistoryOperationRecord(wire));
    const entry = mapHistoryEntry(page.records[0], trustIssuer);
    expect(entry.kind).not.toBe('unsupported');
    if (type === 'allow_trust') {
      expect(entry).toMatchObject({ kind: 'trust-authorization', authorization: 'authorized' });
      expect(mapHistoryEntry(page.records[0], trustor)).toMatchObject({
        kind: 'trust-authorization',
        authorization: 'authorized',
      });
    }
    const normalized = normalizeHistoryCacheSnapshot(
      {
        schemaVersion: 1,
        lastSuccessfulHorizonUpdateAt: new Date(),
        entries: [entry],
        details: [{ operationId: entry.id, entry }],
      },
      { networkId: 'test', accountAddress: trustIssuer },
    );
    expect(normalized.entries[0]).toEqual(entry);
    expect(entry).not.toHaveProperty('amount');
    const { t, formatNumber } = createLocalization('en');
    expect(activityRowPresentation(entry, t, formatNumber).money).toBeUndefined();
  },
);
it('retains invalid present values, treats wire-omitted masks as empty and never coerces numeric authorization', () => {
  expect(
    mapHistoryEntry(
      mapHistoryOperationRecord({ ...raw('set_trust_line_flags'), set_flags: undefined, clear_flags: undefined }),
      trustor,
    ),
  ).toMatchObject({ kind: 'trust-flags', setFlags: [], clearFlags: [] });
  expect(
    mapHistoryEntry(mapHistoryOperationRecord({ ...raw('set_trust_line_flags'), set_flags: null }), trustor),
  ).toMatchObject({ kind: 'unsupported' });
  expect(mapHistoryEntry(mapHistoryOperationRecord({ ...raw('allow_trust'), authorize: 1 }), trustor)).toMatchObject({
    kind: 'unsupported',
  });
  for (const type of trustSponsorshipTypes)
    expect(
      mapHistoryEntry(mapHistoryOperationRecord({ ...raw(type), transaction_successful: false }), trustIssuer),
    ).toMatchObject({ kind: 'failed' });
});
