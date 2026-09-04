import type {HistoryDirection, HistoryEntry} from '@capabilities/history/types';

export type ActivityFilter = 'all' | 'payments' | 'accounts' | 'other';

export type ActivityTone = 'positive' | 'negative' | 'neutral';

type TranslationParams = Readonly<Record<string, string | number>>;
type Translate = (key: string, params?: TranslationParams) => string;
type FormatNumber = (value: string | number, precision?: number) => string;

export type ActivityEntryPresentation = Readonly<{
  title: string;
  primary: string;
  secondary: string;
  tone: ActivityTone;
  filter: Exclude<ActivityFilter, 'all'>;
}>;

export function mergeActivityEntries(
  current: readonly HistoryEntry[],
  incoming: readonly HistoryEntry[],
): HistoryEntry[] {
  const seen = new Set(current.map(entry => entry.id));
  const merged = [...current];

  for (const entry of incoming) {
    if (!seen.has(entry.id)) {
      seen.add(entry.id);
      merged.push(entry);
    }
  }

  return merged;
}

export function activityEntryPresentation(
  entry: HistoryEntry,
  t: Translate,
  formatNumber: FormatNumber,
): ActivityEntryPresentation {
  switch (entry.kind) {
    case 'payment':
      return {
        title: paymentTitle(entry.direction, t),
        primary: `${formatNumber(entry.amount)} ${entry.asset.code}`,
        secondary: entry.counterparty,
        tone: directionTone(entry.direction),
        filter: 'payments',
      };
    case 'create-account':
      return {
        title:
          entry.direction === 'incoming'
            ? t('activity.entry.accountFunded')
            : t('activity.entry.fundedAccount'),
        primary: `${formatNumber(entry.startingBalance)} XLM`,
        secondary: entry.counterparty,
        tone: directionTone(entry.direction),
        filter: 'accounts',
      };
    case 'unsupported':
      return {
        title: t('activity.entry.operation', {operationType: entry.operationType}),
        primary: t('activity.entry.unsupported'),
        secondary: entry.transactionHash,
        tone: 'neutral',
        filter: 'other',
      };
  }
}

export function matchesActivityFilter(
  entry: HistoryEntry,
  filter: ActivityFilter,
): boolean {
  if (filter === 'all') {
    return true;
  }

  switch (entry.kind) {
    case 'payment':
      return filter === 'payments';
    case 'create-account':
      return filter === 'accounts';
    case 'unsupported':
      return filter === 'other';
  }
}

function paymentTitle(direction: HistoryDirection, t: Translate): string {
  switch (direction) {
    case 'incoming':
      return t('activity.entry.received');
    case 'outgoing':
      return t('activity.entry.sent');
    case 'self':
      return t('activity.entry.selfPayment');
    case 'neutral':
      return t('activity.entry.payment');
  }
}

function directionTone(direction: HistoryDirection): ActivityTone {
  switch (direction) {
    case 'incoming':
      return 'positive';
    case 'outgoing':
      return 'negative';
    case 'self':
    case 'neutral':
      return 'neutral';
  }
}
