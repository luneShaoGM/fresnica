import { mapHistoryEntry } from '../../../capabilities/history/loadHistoryPage';
import { controlRecord, controlSource } from '../../../capabilities/history/__tests__/classicControlHistory.fixtures';
import { activityRowPresentation } from '../activityRowPresentation';
import { matchesActivityFilter, matchesActivitySearch } from '../activityList';
import { createLocalization } from '../../../locale/localization';
it('shows localized failure with no money and an explicit failed filter in all locales', () => {
  const entry = mapHistoryEntry(controlRecord('payment', {}, { successful: false, amount: '999' }), controlSource);
  for (const locale of ['en', 'zh', 'zh-TW']) {
    const { t, formatNumber } = createLocalization(locale);
    const names = new Map([[controlSource, 'Source alias']]);
    const row = activityRowPresentation(entry, t, formatNumber, names);
    expect(row.operation).toContain(t('activity.entry.failed'));
    expect(row.money).toBeUndefined();
    expect(row.reserveMoney).toBeUndefined();
    expect(matchesActivityFilter(entry, 'failed')).toBe(true);
    expect(matchesActivityFilter(entry, 'all')).toBe(true);
    expect(matchesActivityFilter(entry, 'payments')).toBe(true);
    expect(matchesActivitySearch(entry, 'Source alias', t, formatNumber, names)).toBe(true);
    expect(matchesActivitySearch(entry, '999', t, formatNumber, names)).toBe(false);
  }
});

it('preserves a failed offer intent subject through cache without adding executed money', () => {
  const record = controlRecord(
    'manage_sell_offer',
    {},
    {
      successful: false,
      amount: '999',
      sellingAsset: { kind: 'native' },
      buyingAsset: { kind: 'credit', code: 'USD', issuer: controlSource },
    },
  );
  const entry = mapHistoryEntry(record, controlSource);
  const { t, formatNumber } = createLocalization('en');
  const row = activityRowPresentation(entry, t, formatNumber);
  expect(row.title).toBe('XLM / USD');
  expect(row.subject.kind).toBe('asset-pair');
  expect(row.money).toBeUndefined();
  expect(entry).not.toHaveProperty('amount');
});
