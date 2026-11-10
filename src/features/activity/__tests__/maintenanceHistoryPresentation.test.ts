import {
  maintenanceRecord,
  maintenanceSource,
  maintenanceTypes,
} from '../../../capabilities/history/__tests__/maintenanceHistory.fixtures';
import { mapHistoryEntry } from '../../../capabilities/history/loadHistoryPage';
import { createLocalization } from '../../../locale/localization';
import { activityRowPresentation } from '../activityRowPresentation';
import { matchesActivityFilter, matchesActivitySearch } from '../activityList';

it.each(maintenanceTypes)('presents %s as neutral source identity without money in all locales', type => {
  const entry = mapHistoryEntry(maintenanceRecord(type), maintenanceSource);
  for (const locale of ['en', 'zh', 'zh-TW']) {
    const { t, formatNumber } = createLocalization(locale);
    const names = new Map([[maintenanceSource, 'My source']]);
    const row = activityRowPresentation(entry, t, formatNumber, names);
    expect(row.title).toBe(
      type === 'extend_footprint_ttl' || type === 'restore_footprint' ? t(`activity.maintenance.${type}`) : 'My source',
    );
    expect(row.subject).toEqual(
      type === 'extend_footprint_ttl' || type === 'restore_footprint'
        ? { kind: 'contract', identity: maintenanceSource }
        : { kind: 'account', address: maintenanceSource },
    );
    expect(row.money).toBeUndefined();
    expect(row.reserveMoney).toBeUndefined();
    expect(row.operation).toBe(t(`activity.maintenance.${type}`));
    expect(matchesActivityFilter(entry, 'other')).toBe(true);
    expect(matchesActivityFilter(entry, 'payments')).toBe(false);
    for (const query of ['My source', type, maintenanceSource, row.operation])
      expect(matchesActivitySearch(entry, query, t, formatNumber, names)).toBe(true);
    if (type !== 'restore_footprint')
      expect(
        matchesActivitySearch(
          entry,
          type === 'manage_data'
            ? 'config.memo_required'
            : type === 'bump_sequence'
              ? '9223372036854775807'
              : '4294967295',
          t,
          formatNumber,
        ),
      ).toBe(true);
  }
});
