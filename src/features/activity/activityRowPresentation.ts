import { isPathSwap } from '@capabilities/history/pathPaymentHistory';
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
    | Readonly<{ kind: 'asset-pair'; source: HistoryAsset; destination: HistoryAsset }>
    | Readonly<{ kind: 'contract'; identity: string }>
    | Readonly<{ kind: 'reference'; identity: string }>
    | Readonly<{ kind: 'unsupported' }>;
  money?: Readonly<{ amount: string; asset: HistoryAsset; tone: ActivityTone }>;
  reserveMoney?: readonly Readonly<{ amount: string; asset: HistoryAsset; tone: ActivityTone }>[];
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
    case 'trust-authorization':
    case 'trust-flags':
      return { title: entry.asset.code, operation: detail.title, subject: { kind: 'asset', asset: entry.asset } };
    case 'sponsorship': {
      const peer = entry.role === 'sponsor' ? entry.beneficiary : entry.sponsor;
      return {
        title: names?.get(peer)?.trim() || formatPublicAddress(peer),
        operation: detail.title,
        subject: { kind: 'account', address: peer },
      };
    }
    case 'account-control':
      return { title: names?.get(entry.counterparty ?? entry.sourceAccount)?.trim() || formatPublicAddress(entry.counterparty ?? entry.sourceAccount),
        operation: detail.title, subject: { kind: 'account', address: entry.counterparty ?? entry.sourceAccount } };
    case 'maintenance':
      return {
        title: names?.get(entry.sourceAccount)?.trim() || formatPublicAddress(entry.sourceAccount),
        operation: detail.title,
        subject: { kind: 'account', address: entry.sourceAccount },
      };
    case 'contract': {
      const identity = entry.contractId ?? entry.deployer;
      return {
        title: entry.creationAsset?.code ?? (identity ? (identity.startsWith('G') ? names?.get(identity)?.trim() : undefined) || formatPublicAddress(identity) : detail.title),
        operation: [detail.title, entry.functionName].filter(Boolean).join(' · '),
        subject: entry.creationAsset ? { kind: 'asset', asset: entry.creationAsset } : identity ? (identity.startsWith('G') ? { kind: 'account', address: identity } : { kind: 'contract', identity }) : { kind: 'unsupported' },
        reserveMoney: (entry.events ?? [])
          .filter(event => event.direction !== 'neutral')
          .slice(0, 2)
          .map(event => {
            const zero = /^0+(?:\.0+)?$/.test(event.amount);
            const tone =
              zero || event.direction === 'self' ? 'neutral' : event.direction === 'incoming' ? 'positive' : 'negative';
            return {
              amount: `${tone === 'positive' ? '+' : tone === 'negative' ? '−' : ''}${formatNumber(event.amount, 7)}`,
              asset: event.asset,
              tone,
            };
          }),
      };
    }
    case 'claimable-reference':
      return {
        title: formatPublicAddress(entry.balanceId),
        operation: detail.title,
        subject: { kind: 'reference', identity: entry.balanceId },
      };
    case 'claimable-create':
    case 'clawback': {
      const monetary = entry.kind === 'claimable-create' ? entry.role === 'funder' : entry.role === 'holder';
      return {
        title: entry.asset.code,
        operation: detail.title,
        subject: { kind: 'asset', asset: entry.asset },
        ...(monetary
          ? {
              money: {
                amount: `${detail.tone === 'negative' ? '−' : ''}${formatNumber(entry.amount, 7)}`,
                asset: entry.asset,
                tone: detail.tone,
              },
            }
          : {}),
      };
    }
    case 'offer':
      return {
        title: `${entry.sellingAsset.code} → ${entry.buyingAsset.code}`,
        operation: detail.title,
        subject: { kind: 'asset-pair', source: entry.sellingAsset, destination: entry.buyingAsset },
      };
    case 'liquidity-pool': {
      const deposit = entry.operationType === 'liquidity_pool_deposit';
      return {
        title: entry.reserves.map(leg => leg.asset.code).join(' / '),
        operation: detail.title,
        subject: { kind: 'asset-pair', source: entry.reserves[0].asset, destination: entry.reserves[1].asset },
        reserveMoney: entry.reserves.map(leg => ({
          amount: `${deposit ? '−' : '+'}${formatNumber(leg.amount, 7)}`,
          asset: leg.asset,
          tone: deposit ? 'negative' : 'positive',
        })),
      };
    }
    case 'path-payment': {
      const swap = isPathSwap(entry);
      const pair = `${entry.sourceAsset.code} → ${entry.destinationAsset.code}`;
      const outgoing = entry.direction === 'outgoing';
      const prefix = detail.tone === 'positive' ? '+' : detail.tone === 'negative' ? '−' : '';
      return {
        title: swap
          ? t('activity.entry.swap')
          : names?.get(entry.counterparty)?.trim() || formatPublicAddress(entry.counterparty),
        operation: `${detail.title} · ${pair}`,
        subject: swap
          ? { kind: 'asset-pair', source: entry.sourceAsset, destination: entry.destinationAsset }
          : { kind: 'account', address: entry.counterparty },
        money: {
          amount: `${prefix}${formatNumber(outgoing ? entry.sourceAmount : entry.destinationAmount, 7)}`,
          asset: outgoing ? entry.sourceAsset : entry.destinationAsset,
          tone: detail.tone,
        },
      };
    }
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
