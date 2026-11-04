import {
  controlCases,
  controlSource,
  controlRecord,
} from '../../../capabilities/history/__tests__/classicControlHistory.fixtures';
import { mapHistoryEntry } from '../../../capabilities/history/loadHistoryPage';
import { activityRowPresentation } from '../activityRowPresentation';
import { matchesActivityFilter, matchesActivitySearch } from '../activityList';
import { createLocalization } from '../../../locale/localization';
it.each(controlCases)(
  'renders %s %j as neutral identity, Other and searchable exact parameters',
  (type, parameters) => {
    const entry = mapHistoryEntry(controlRecord(type, parameters), controlSource);
    for (const locale of ['en', 'zh', 'zh-TW']) {
      const { t, formatNumber } = createLocalization(locale);
      const names = new Map([[controlSource, 'Control source']]);
      const row = activityRowPresentation(entry, t, formatNumber, names);
      expect(matchesActivitySearch(entry, 'Control source', t, formatNumber, names)).toBe(true);
      expect(row.money).toBeUndefined();
      expect(row.operation).toBe(t(`activity.control.${type}`));
      expect(row.operation).not.toBe(`activity.control.${type}`);
      expect(matchesActivityFilter(entry, 'other')).toBe(true);
      expect(matchesActivityFilter(entry, 'payments')).toBe(false);
      for (const value of Object.values(parameters)) {
        if (String(value)) expect(matchesActivitySearch(entry, String(value), t, formatNumber)).toBe(true);
      }
    }
  },
);
