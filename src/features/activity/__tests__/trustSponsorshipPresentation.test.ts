import {
  trustSponsorshipRecord,
  trustSponsorshipTypes,
  trustIssuer,
  trustor,
} from '../../../capabilities/history/__tests__/trustSponsorshipHistory.fixtures';
import { mapHistoryEntry } from '../../../capabilities/history/loadHistoryPage';
import { activityRowPresentation } from '../activityRowPresentation';
import { matchesActivityFilter, matchesActivitySearch } from '../activityList';
import { createLocalization } from '../../../locale/localization';

it.each(trustSponsorshipTypes)('renders %s for both roles with no money and searchable exact evidence', type => {
  const names = new Map([
    [trustIssuer, 'Global issuer'],
    [trustor, 'Global trustor'],
  ]);
  for (const address of [trustIssuer, trustor]) {
    const entry = mapHistoryEntry(trustSponsorshipRecord(type), address);
    for (const locale of ['en', 'zh', 'zh-TW']) {
      const { t, formatNumber } = createLocalization(locale);
      const row = activityRowPresentation(entry, t, formatNumber, names);
      expect(row.money).toBeUndefined();
      expect(row.reserveMoney).toBeUndefined();
      expect(matchesActivityFilter(entry, 'other')).toBe(true);
      expect(matchesActivityFilter(entry, 'trustlines')).toBe(false);
      for (const query of [type, trustIssuer, trustor, row.operation, 'Global issuer', 'Global trustor'])
        expect(matchesActivitySearch(entry, query, t, formatNumber, names)).toBe(true);
      if (entry.kind === 'sponsorship') {
        const peer = address === trustIssuer ? trustor : trustIssuer;
        expect(row.subject).toEqual({ kind: 'account', address: peer });
        expect(row.title).toBe(names.get(peer));
      } else {
        expect(row.title).toBe('USD');
        expect(row.subject).toMatchObject({ kind: 'asset', asset: { kind: 'credit', issuer: trustIssuer } });
        expect(matchesActivitySearch(entry, `USD:${trustIssuer}`, t, formatNumber)).toBe(true);
      }
      if (entry.kind === 'trust-flags')
        for (const query of ['4', t('activity.trustControl.flag.4')])
          expect(matchesActivitySearch(entry, query, t, formatNumber)).toBe(true);
    }
  }
});
it('preserves three distinct authorization labels and never mistakes issued XLM for native', () => {
  const { t, formatNumber } = createLocalization('en');
  const labels = [
    [true, false],
    [false, true],
    [false, false],
  ].map(([authorize, authorizeToMaintainLiabilities]) => {
    const entry = mapHistoryEntry(
      trustSponsorshipRecord('allow_trust', {
        authorize,
        authorizeToMaintainLiabilities,
        asset: { kind: 'credit', code: 'XLM', issuer: trustIssuer },
      }),
      trustor,
    );
    const row = activityRowPresentation(entry, t, formatNumber);
    expect(row.subject).toMatchObject({ kind: 'asset', asset: { kind: 'credit', code: 'XLM', issuer: trustIssuer } });
    return row.operation;
  });
  expect(new Set(labels).size).toBe(3);
});
