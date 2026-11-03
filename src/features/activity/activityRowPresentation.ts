import type { HistoryAsset, HistoryEntry } from '@capabilities/history/types';
import { formatPublicAddress } from '@ui/formatPublicAddress';
import { activityEntryPresentation, type ActivityTone } from './activityList';

type Translate = (key: string, params?: Readonly<Record<string, string | number>>) => string;
type FormatNumber = (value: string | number, precision?: number) => string;
export type ActivityIdentityNames = ReadonlyMap<string, string>;
export type ActivityRowPresentation = Readonly<{
  title: string;
  operation: string;
  subject:
    | Readonly<{ kind: 'account'; address: string }>
    | Readonly<{ kind: 'asset'; asset: HistoryAsset }>
    | Readonly<{ kind: 'unsupported' }>;
  money?: Readonly<{ amount: string; asset: HistoryAsset; tone: ActivityTone }>;
}>;

// List presentation is deliberately separate from the exact operation detail summary.
export function activityRowPresentation(
  entry: HistoryEntry,
  t: Translate,
  formatNumber: FormatNumber,
  names?: ActivityIdentityNames,
): ActivityRowPresentation {
  const detail = activityEntryPresentation(entry, t, formatNumber);
  switch (entry.kind) {
    case 'payment':
    case 'create-account': {
      const asset: HistoryAsset = entry.kind === 'payment' ? entry.asset : { kind: 'native', code: 'XLM' };
      const rawAmount = entry.kind === 'payment' ? entry.amount : entry.startingBalance;
      const prefix = detail.tone === 'positive' ? '+' : detail.tone === 'negative' ? '−' : '';
      return {
        title: names?.get(entry.counterparty)?.trim() || formatPublicAddress(entry.counterparty),
        operation: entry.kind === 'create-account' ? t('activity.entry.createAccount') : detail.title,
        subject: { kind: 'account', address: entry.counterparty },
        money: { amount: `${prefix}${formatNumber(rawAmount, 7)}`, asset, tone: detail.tone },
      };
    }
    case 'change-trust':
      return {
        title: entry.asset.code,
        operation: t(
          /^0+(?:\.0+)?$/.test(entry.limit) ? 'activity.entry.trustlineRemoved' : 'activity.entry.trustlineChanged',
        ),
        subject: { kind: 'asset', asset: entry.asset },
      };
    case 'unsupported':
      return { title: detail.title, operation: t('activity.entry.unsupported'), subject: { kind: 'unsupported' } };
  }
}

export function activityAssetIdentity(asset: HistoryAsset): string {
  return asset.kind === 'native' ? 'native:XLM' : JSON.stringify([asset.code, asset.issuer]);
}
