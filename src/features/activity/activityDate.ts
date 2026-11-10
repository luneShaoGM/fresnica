export function localActivityDay(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function activityDateLabel(
  date: Date,
  now: Date,
  formatter: Intl.DateTimeFormat,
  t: (key: string) => string,
): string {
  const day = localActivityDay(date);
  if (day === localActivityDay(now)) return t('activity.date.today');
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  return day === localActivityDay(yesterday) ? t('activity.date.yesterday') : formatter.format(date);
}
