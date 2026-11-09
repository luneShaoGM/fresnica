import { activityDateLabel, localActivityDay } from '../activityDate';
import { createLocalization } from '../../../locale/localization';
const formatter = new Intl.DateTimeFormat('en', { year: 'numeric', month: 'long', day: 'numeric' });
it.each(['en', 'zh', 'zh-TW'])('localizes current and previous calendar days in %s', locale => {
  const { t } = createLocalization(locale);
  const now = new Date(2026, 0, 1, 0, 1);
  expect(activityDateLabel(new Date(2026, 0, 1, 23, 59), now, formatter, t)).toBe(t('activity.date.today'));
  expect(activityDateLabel(new Date(2025, 11, 31, 0, 1), now, formatter, t)).toBe(t('activity.date.yesterday'));
  expect(activityDateLabel(new Date(2025, 11, 30), now, formatter, t)).toContain('2025');
  expect(activityDateLabel(new Date(2026, 0, 2), now, formatter, t)).toBe(formatter.format(new Date(2026, 0, 2)));
});
it('uses local calendar arithmetic through DST, month/year boundaries, and midnight rollover', () => {
  const { t } = createLocalization('en');
  for (const [month, day] of [
    [2, 9],
    [10, 2],
    [2, 1],
    [0, 1],
  ]) {
    const now = new Date(2026, month, day, 0, 1);
    const previous = new Date(2026, month, day - 1, 0, 2);
    expect(activityDateLabel(previous, now, formatter, t)).toBe('Yesterday');
  }
  const entry = new Date(2026, 10, 9, 23, 59);
  expect(activityDateLabel(entry, new Date(2026, 10, 9, 23, 59), formatter, t)).toBe('Today');
  expect(activityDateLabel(entry, new Date(2026, 10, 10, 0, 0), formatter, t)).toBe('Yesterday');
  expect(localActivityDay(new Date(2025, 0, 1))).not.toBe(localActivityDay(new Date(2026, 0, 1)));
});
