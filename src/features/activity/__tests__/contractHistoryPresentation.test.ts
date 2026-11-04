import { claimPredicateSummary } from './claimPredicateSummary';
import { isPathSwap } from '@capabilities/history/pathPaymentHistory';
import type { HistoryDirection, HistoryEntry } from '@capabilities/history/types';

export type ActivityFilter = 'all' | 'payments' | 'accounts' | 'trustlines' | 'other';

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
    case 'account-control':
      return { title: t(`activity.control.${entry.operationType}`), primary: entry.counterparty ?? entry.sourceAccount, secondary: '', tone: 'neutral', filter: 'other' };
    case 'trust-authorization':
      return {
        title: t(`activity.trustControl.authorization.${entry.authorization}`),
        primary: entry.asset.code,
        secondary: entry.trustor,
        tone: 'neutral',
        filter: 'other',
      };
    case 'trust-flags':
      return {
        title: t('activity.trustControl.flags'),
        primary: entry.asset.code,
        secondary: entry.trustor,
        tone: 'neutral',
        filter: 'other',
      };
    case 'sponsorship':
      return {
        title: t(`activity.sponsorship.${entry.operationType}`),
        primary: entry.role === 'sponsor' ? entry.beneficiary : entry.sponsor,
        secondary: '',
        tone: 'neutral',
        filter: 'other',
      };
    case 'maintenance':
      return {
        title: t(`activity.maintenance.${entry.operationType}`),
        primary: entry.dataName ?? entry.bumpTo ?? (entry.extendTo === undefined ? '' : String(entry.extendTo)),
        secondary: entry.sourceAccount,
        tone: 'neutral',
        filter: 'other',
      };
    case 'contract': {
      const relevant = entry.events?.filter(event => event.direction !== 'neutral') ?? [];
      const title = t(
        `activity.entry.contract${entry.hostFunction === 'invoke' ? 'Invoke' : entry.hostFunction === 'create' ? 'Create' : entry.hostFunction === 'create-v2' ? 'Constructor' : 'Upload'}`,
      );
      return {
        title:
          relevant.length > 2 ? `${title} · ${t('activity.contract.previewCount', { count: relevant.length })}` : title,
        primary: entry.contractId ?? title,
        secondary: entry.functionName ?? '',
        tone: 'neutral',
        filter: 'other',
      };
    }
    case 'claimable-create':
      return {
        title: t(
          `activity.entry.claimable${entry.role === 'funder' ? 'Funded' : entry.role === 'issuer' ? 'Issued' : 'Created'}`,
        ),
        primary: `${formatNumber(entry.amount, 7)} ${entry.asset.code}`,
        secondary: entry.claimants.map(c => c.destination).join(' / '),
        tone: entry.role === 'funder' ? 'negative' : 'neutral',
        filter: 'other',
      };
    case 'claimable-reference':
      return {
        title: t(
          entry.operationType === 'claim_claimable_balance'
            ? 'activity.entry.claimableClaimed'
            : 'activity.entry.claimableClawedBack',
        ),
        primary: t('activity.detail.amountUnavailable'),
        secondary: entry.balanceId,
        tone: 'neutral',
        filter: 'other',
      };
    case 'clawback':
      return {
        title: t('activity.entry.clawback'),
        primary: `${formatNumber(entry.amount, 7)} ${entry.asset.code}`,
        secondary: entry.holder,
        tone: entry.role === 'holder' && !/^0+(?:\.0+)?$/.test(entry.amount) ? 'negative' : 'neutral',
        filter: 'other',
      };
    case 'offer':
      return {
        title: t(
          entry.operationType === 'create_passive_sell_offer'
            ? 'activity.entry.passiveOffer'
            : entry.cancellation
              ? 'activity.entry.offerCancellation'
              : entry.operationType === 'manage_buy_offer'
                ? 'activity.entry.buyOfferChanged'
                : 'activity.entry.sellOfferChanged',
        ),
        primary: `${entry.sellingAsset.code} → ${entry.buyingAsset.code}`,
        secondary: entry.offerId ?? '',
        tone: 'neutral',
        filter: 'other',
      };
    case 'liquidity-pool':
      return {
        title: t(
          entry.operationType === 'liquidity_pool_deposit'
            ? 'activity.entry.poolDeposit'
            : 'activity.entry.poolWithdrawal',
        ),
        primary: entry.reserves.map(leg => `${formatNumber(leg.amount, 7)} ${leg.asset.code}`).join(' / '),
        secondary: entry.poolId,
        tone: 'neutral',
        filter: 'other',
      };
    case 'path-payment': {
      const outgoing = entry.direction === 'outgoing';
      const amount = outgoing ? entry.sourceAmount : entry.destinationAmount;
      const asset = outgoing ? entry.sourceAsset : entry.destinationAsset;
      return {
        title: t(isPathSwap(entry) ? 'activity.entry.swap' : 'activity.entry.pathPayment'),
        primary: `${formatNumber(amount, 7)} ${asset.code}`,
        secondary: `${entry.sourceAsset.code} → ${entry.destinationAsset.code}`,
        tone: isPathSwap(entry) ? 'positive' : directionTone(entry.direction),
        filter: 'payments',
      };
    }
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
        title: entry.direction === 'incoming' ? t('activity.entry.accountFunded') : t('activity.entry.fundedAccount'),
        primary: `${formatNumber(entry.startingBalance)} XLM`,
        secondary: entry.counterparty,
        tone: directionTone(entry.direction),
        filter: 'accounts',
      };
    case 'change-trust':
      return {
        title: t('activity.entry.trustlineChanged'),
        primary: `${formatNumber(entry.limit)} ${entry.asset.code}`,
        secondary: entry.asset.issuer,
        tone: 'neutral',
        filter: 'trustlines',
      };
    case 'unsupported':
      return {
        title: t('activity.entry.operation', { operationType: entry.operationType }),
        primary: t('activity.entry.unsupported'),
        secondary: entry.transactionHash,
        tone: 'neutral',
        filter: 'other',
      };
  }
}

export function matchesActivityFilter(entry: HistoryEntry, filter: ActivityFilter): boolean {
  if (filter === 'all') {
    return true;
  }

  switch (entry.kind) {
    case 'path-payment':
    case 'payment':
      return filter === 'payments';
    case 'create-account':
      return filter === 'accounts';
    case 'change-trust':
      return filter === 'trustlines';
    case 'trust-authorization':
    case 'trust-flags':
    case 'sponsorship':
    case 'account-control':
    case 'maintenance':
    case 'contract':
    case 'claimable-create':
    case 'claimable-reference':
    case 'clawback':
    case 'offer':
    case 'liquidity-pool':
    case 'unsupported':
      return filter === 'other';
  }
}

export function matchesActivitySearch(
  entry: HistoryEntry,
  searchText: string,
  t: Translate,
  formatNumber: FormatNumber,
  identityNames?: ReadonlyMap<string, string>,
): boolean {
  const query = searchText.trim().toLowerCase();
  if (!query) {
    return true;
  }

  const presentation = activityEntryPresentation(entry, t, formatNumber);
  const values = [
    presentation.title,
    presentation.primary,
    presentation.secondary,
    entry.transactionHash,
    entry.id,
    entry.operationType,
    entry.sourceAccount,
  ];

  if (entry.kind === 'trust-authorization' || entry.kind === 'trust-flags') {
    values.push(
      entry.asset.code,
      entry.asset.issuer,
      `${entry.asset.code}:${entry.asset.issuer}`,
      entry.trustor,
      identityNames?.get(entry.trustor) ?? '',
      identityNames?.get(entry.sourceAccount) ?? '',
    );
    if (entry.kind === 'trust-authorization')
      values.push(entry.authorization, t(`activity.trustControl.authorization.${entry.authorization}`));
    else
      for (const flag of [...entry.setFlags, ...entry.clearFlags])
        values.push(String(flag), t(`activity.trustControl.flag.${flag}`));
  }
  if (entry.kind === 'sponsorship')
    values.push(
      entry.sponsor,
      entry.beneficiary,
      entry.role,
      identityNames?.get(entry.sponsor) ?? '',
      identityNames?.get(entry.beneficiary) ?? '',
    );
  if (entry.kind === 'account-control') {
    values.push(identityNames?.get(entry.sourceAccount) ?? '');
    for (const [key, value] of Object.entries(entry.parameters)) values.push(t(`activity.control.field.${key}`), String(value));
  }
  if (entry.kind === 'maintenance') {
    values.push(
      entry.dataName ?? '',
      entry.bumpTo ?? '',
      entry.extendTo === undefined ? '' : String(entry.extendTo),
      identityNames?.get(entry.sourceAccount) ?? '',
    );
  }
  if (entry.kind === 'contract') {
    values.push(entry.hostFunction, entry.contractId ?? '', entry.functionName ?? '', entry.deployer ?? '', entry.creationOrigin ?? '');
    if (entry.creationAsset) values.push(entry.creationAsset.code, entry.creationAsset.kind === 'credit' ? entry.creationAsset.issuer : '', entry.creationAsset.kind === 'credit' ? `${entry.creationAsset.code}:${entry.creationAsset.issuer}` : 'native');
    if (entry.deployer?.startsWith('G')) values.push(identityNames?.get(entry.deployer) ?? '');
    for (const event of entry.events ?? []) {
      values.push(
        event.type,
        t(`activity.contract.event.${event.type}`),
        event.amount,
        formatNumber(event.amount, 7),
        event.asset.code,
        event.from ?? '',
        event.to ?? '',
        event.destinationMuxedId ?? '',
      );
      if (event.asset.kind === 'credit') values.push(event.asset.issuer, `${event.asset.code}:${event.asset.issuer}`);
      if (event.from?.startsWith('G')) values.push(identityNames?.get(event.from) ?? '');
      if (event.to?.startsWith('G') && event.destinationMuxedId === undefined)
        values.push(identityNames?.get(event.to) ?? '');
    }
  }
  if (entry.kind === 'claimable-create' || entry.kind === 'clawback') {
    values.push(entry.amount, formatNumber(entry.amount, 7));
    if (entry.asset.kind === 'credit') values.push(`${entry.asset.code}:${entry.asset.issuer}`);
    if (entry.kind === 'claimable-create') {
      for (const claimant of entry.claimants)
        values.push(
          claimant.destination,
          JSON.stringify(claimant.predicate),
          claimPredicateSummary(claimant.predicate, t),
          identityNames?.get(claimant.destination) ?? '',
        );
    } else values.push(entry.holder, entry.holderBase, identityNames?.get(entry.holder) ?? '');
  }
  if (entry.kind === 'claimable-reference') values.push(entry.balanceId);
  if (entry.kind === 'claimable-reference' || entry.kind === 'claimable-create' || entry.kind === 'clawback')
    values.push(identityNames?.get(entry.sourceAccount) ?? '');
  if (entry.kind === 'offer' || entry.kind === 'liquidity-pool') {
    const assets =
      entry.kind === 'offer' ? [entry.sellingAsset, entry.buyingAsset] : entry.reserves.map(leg => leg.asset);
    for (const asset of assets) {
      values.push(asset.code);
      if (asset.kind === 'credit') values.push(asset.issuer);
    }
    const amounts = entry.kind === 'offer' ? [entry.amount] : [entry.shares, ...entry.reserves.map(leg => leg.amount)];
    for (const amount of amounts) values.push(amount, formatNumber(amount, 7));
    if (entry.kind === 'offer')
      values.push(
        entry.offerId ?? '',
        String(entry.price.n),
        String(entry.price.d),
        `${entry.price.n}/${entry.price.d}`,
      );
    else values.push(entry.poolId);
  }
  if ('counterparty' in entry && entry.counterparty) values.push(identityNames?.get(entry.counterparty) ?? '');
  if (entry.kind === 'path-payment') {
    values.push(
      entry.sourceAmount,
      entry.destinationAmount,
      formatNumber(entry.sourceAmount, 7),
      formatNumber(entry.destinationAmount, 7),
      t('activity.entry.pathPayment'),
    );
    for (const asset of [entry.sourceAsset, entry.destinationAsset]) {
      values.push(asset.code);
      if (asset.kind === 'credit') values.push(asset.issuer);
    }
    for (const participant of entry.participants) values.push(identityNames?.get(participant.identity) ?? '');
  }
  if (entry.kind === 'payment') values.push(entry.amount, formatNumber(entry.amount, 7));
  if (entry.kind === 'create-account') {
    values.push(entry.startingBalance, formatNumber(entry.startingBalance, 7), t('activity.entry.createAccount'));
  }
  if (entry.kind === 'change-trust') {
    values.push(entry.limit);
    if (/^0+(?:\.0+)?$/.test(entry.limit)) values.push(t('activity.entry.trustlineRemoved'));
  }

  if ('participants' in entry) {
    for (const participant of entry.participants) {
      values.push(participant.identity);
      if (participant.baseAccount) {
        values.push(participant.baseAccount);
      }
    }
  }

  if ('asset' in entry) {
    values.push(entry.asset.code);
    if (entry.asset.kind === 'credit') {
      values.push(entry.asset.issuer);
    }
  }

  return values.some(value => value.toLowerCase().includes(query));
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

it.each(['create', 'create-v2'] as const)('searches canonical origin asset identity for %s in every locale', host => {
  const entry = mapHistoryEntry(contractRecord({ hostFunction: CONTRACT_HOST_FUNCTIONS[host], creationOrigin: 'asset', creationAsset: { kind: 'credit', code: 'USD', issuer: foreign } }), source);
  for (const locale of ['en', 'zh', 'zh-TW']) {
    const localization = createLocalization(locale);
    expect(matchesActivitySearch(entry, `USD:${foreign}`, localization.t, localization.formatNumber)).toBe(true);
  }
});
