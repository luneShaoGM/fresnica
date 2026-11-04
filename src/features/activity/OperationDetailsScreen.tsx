import { claimPredicateSummary } from './claimPredicateSummary';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, Text, View } from 'react-native';

import type { AccountRecord } from '@capabilities/account/types';
import {
  loadHistoryOperationDetails,
  type HistoryOperationDetails,
} from '@capabilities/history/loadHistoryOperationDetails';
import {
  cacheHistoryReadyDetailBestEffort,
  readCachedHistoryDetail,
  readHistoryCacheSnapshotBestEffort,
  removeCachedHistoryDetailBestEffort,
  type HistoryProductDependencies,
} from '@capabilities/history/HistoryCacheHydration';
import type {
  HistoryDirection,
  HistoryEntry,
  HistoryParticipant,
  HistoryParticipantRole,
} from '@capabilities/history/types';
import { Header, Screen, StateView } from '@ui/components';
import { useThemedStyles } from '@ui/theme';

import { ParticipantCard } from '../contacts/ParticipantCard';
import type { ContactBook } from '../contacts/contactBook';
import { useLocalization } from '../../locale';
import { projectFeatureError } from '../featureError';
import { activityEntryPresentation } from './activityList';
import { createStyles } from './OperationDetailsScreen.styles';

type LoadState =
  | Readonly<{ kind: 'loading' }>
  | Readonly<{ kind: 'error'; message: string }>
  | Readonly<{
      kind: 'loaded';
      result: HistoryOperationDetails;
      source: 'cache' | 'online';
      stale: boolean;
      refreshing: boolean;
      refreshFailed: boolean;
      lastSuccessfulHorizonUpdateAt?: Date;
    }>;

type Props = Readonly<{
  account: AccountRecord;
  accounts: readonly AccountRecord[];
  contacts?: ContactBook;
  operationId: string;
  dependencies: HistoryProductDependencies;
  active: boolean;
  invalidationRevision: number;
  onBack: () => void;
  openExternalUrl: (url: string) => Promise<void>;
  projectExplorerUrl: (transactionHash: string) => string | undefined;
}>;

export function OperationDetailsScreen({
  account,
  accounts,
  contacts,
  operationId,
  dependencies,
  active,
  invalidationRevision,
  onBack,
  openExternalUrl,
  projectExplorerUrl,
}: Props) {
  const { formatNumber, locale, t } = useLocalization();
  const styles = useThemedStyles(createStyles);
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [explorerOpenState, setExplorerOpenState] = useState<'idle' | 'opening' | 'failed'>('idle');
  const requestVersion = useRef(0);
  const partition = JSON.stringify([dependencies.networkId, account.networkId, account.address, operationId]);
  const displayedPartition = useRef(partition);

  const load = useCallback(() => {
    const version = requestVersion.current + 1;
    requestVersion.current = version;
    const changed = displayedPartition.current !== partition;
    displayedPartition.current = partition;

    const snapshot = readHistoryCacheSnapshotBestEffort(dependencies, account);
    const cachedEntry = readCachedHistoryDetail(snapshot, operationId);
    setState(current => {
      if (!changed && current.kind !== 'loading') return current;
      if (cachedEntry) {
        return {
          kind: 'loaded',
          result: { status: 'ready', entry: cachedEntry },
          source: 'cache',
          stale: true,
          refreshing: true,
          refreshFailed: false,
          ...(snapshot === undefined
            ? {}
            : {
                lastSuccessfulHorizonUpdateAt: new Date(snapshot.lastSuccessfulHorizonUpdateAt),
              }),
        };
      }
      return { kind: 'loading' };
    });

    void loadHistoryOperationDetails(dependencies, account, operationId)
      .then(result => {
        if (requestVersion.current !== version) {
          return;
        }

        if (result.status === 'ready') {
          cacheHistoryReadyDetailBestEffort(dependencies, account, result.entry);
        } else if (result.status === 'not-found' || result.status === 'not-associated') {
          removeCachedHistoryDetailBestEffort(dependencies, account, operationId);
        }

        setState(current =>
          current.kind === 'loaded' &&
          !current.stale &&
          !current.refreshFailed &&
          JSON.stringify(current.result) === JSON.stringify(result)
            ? current
            : {
                kind: 'loaded',
                result,
                source: 'online',
                stale: false,
                refreshing: false,
                refreshFailed: false,
              },
        );
      })
      .catch(error => {
        if (requestVersion.current !== version) {
          return;
        }

        setState(current => {
          if (current.kind === 'loaded' && current.result.status === 'ready') {
            return {
              ...current,
              stale: true,
              refreshing: false,
              refreshFailed: true,
            };
          }
          return {
            kind: 'error',
            message: projectFeatureError(error, {
              fallbackMessage: t('activity.detail.errorMessage'),
              fallbackRetryable: true,
            }).message,
          };
        });
      });
  }, [account, dependencies, operationId, partition, t]);

  useEffect(() => {
    if (!active) {
      return;
    }
    load();
    return () => {
      requestVersion.current += 1;
    };
  }, [active, invalidationRevision, load]);

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    [locale],
  );

  const explorerUrl = useMemo(
    () =>
      state.kind === 'loaded' && state.result.status === 'ready'
        ? projectExplorerUrl(state.result.entry.transactionHash)
        : undefined,
    [projectExplorerUrl, state],
  );

  useEffect(() => {
    setExplorerOpenState('idle');
  }, [explorerUrl]);

  const openExplorer = useCallback(async () => {
    if (explorerUrl === undefined || explorerOpenState === 'opening') {
      return;
    }

    setExplorerOpenState('opening');
    try {
      await openExternalUrl(explorerUrl);
      setExplorerOpenState('idle');
    } catch {
      setExplorerOpenState('failed');
      AccessibilityInfo.announceForAccessibility(t('activity.detail.explorer.error'));
    }
  }, [explorerOpenState, explorerUrl, openExternalUrl, t]);

  return (
    <Screen scrollable={false} contentInset="none">
      <View style={styles.headerBar}>
        <Header
          title={t('activity.detail.title')}
          subtitle={account.label || shortAddress(account.address)}
          leading={
            <Pressable
              accessibilityLabel={t('common.back')}
              accessibilityRole="button"
              onPress={onBack}
              style={styles.backButton}
            >
              <Text style={styles.backGlyph}>‹</Text>
            </Pressable>
          }
        />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {renderContent(
          displayedPartition.current === partition ? state : { kind: 'loading' },
          load,
          dateFormatter,
          formatNumber,
          t,
          styles,
          explorerUrl,
          explorerOpenState,
          openExplorer,
          (address, label) =>
            contacts && contacts.network.id === account.networkId && contacts.isClassicAccountAddress(address) ? (
              <ParticipantCard
                key={`${account.networkId}:${address}:${label}`}
                book={contacts}
                accounts={accounts}
                address={address}
                label={label}
                active={active}
              />
            ) : (
              <DetailRow label={label} value={address} mono styles={styles} />
            ),
        )}
      </ScrollView>
    </Screen>
  );
}

type Translate = ReturnType<typeof useLocalization>['t'];
type FormatNumber = ReturnType<typeof useLocalization>['formatNumber'];
type Styles = ReturnType<typeof createStyles>;

function renderContent(
  state: LoadState,
  onRefresh: () => void,
  dateFormatter: Intl.DateTimeFormat,
  formatNumber: FormatNumber,
  t: Translate,
  styles: Styles,
  explorerUrl: string | undefined,
  explorerOpenState: 'idle' | 'opening' | 'failed',
  onOpenExplorer: () => void,
  renderAccount: (address: string, label: string) => React.ReactNode,
) {
  if (state.kind === 'loading') {
    return (
      <StateView kind="loading" title={t('activity.detail.title')} message={t('activity.detail.loadingMessage')} />
    );
  }
  if (state.kind === 'error') {
    return (
      <StateView
        kind="error"
        title={t('activity.detail.errorTitle')}
        message={state.message}
        actionLabel={t('activity.retry')}
        onAction={onRefresh}
      />
    );
  }

  switch (state.result.status) {
    case 'not-found':
      return (
        <StateView
          kind="empty"
          title={t('activity.detail.notFoundTitle')}
          message={t('activity.detail.notFoundMessage')}
          actionLabel={t('activity.detail.refresh')}
          onAction={onRefresh}
        />
      );
    case 'not-associated':
      return (
        <StateView
          kind="error"
          title={t('activity.detail.notAssociatedTitle')}
          message={t('activity.detail.notAssociatedMessage')}
        />
      );
    case 'unsupported-account':
      return (
        <StateView
          kind="empty"
          title={t('activity.detail.unsupportedAccountTitle')}
          message={t('activity.detail.unsupportedAccountMessage')}
        />
      );
    case 'ready':
      return (
        <>
          {state.stale ? (
            <DetailCacheStatus
              dateFormatter={dateFormatter}
              onRefresh={onRefresh}
              refreshFailed={state.refreshFailed}
              refreshing={state.refreshing}
              source={state.source}
              styles={styles}
              t={t}
              updatedAt={state.lastSuccessfulHorizonUpdateAt}
            />
          ) : null}
          {renderEntry(
            state.result.entry,
            dateFormatter,
            formatNumber,
            t,
            styles,
            explorerUrl,
            explorerOpenState,
            onOpenExplorer,
            renderAccount,
          )}
        </>
      );
  }
}

export function DetailCacheStatus({
  source,
  refreshing,
  refreshFailed,
  updatedAt,
  dateFormatter,
  onRefresh,
  t,
  styles,
}: Readonly<{
  source: 'cache' | 'online';
  refreshing: boolean;
  refreshFailed: boolean;
  updatedAt?: Date;
  dateFormatter: Intl.DateTimeFormat;
  onRefresh: () => void;
  t: Translate;
  styles: Styles;
}>) {
  const title = source === 'cache' ? t('activity.detail.cache.cachedTitle') : t('activity.detail.cache.staleTitle');
  const message = refreshing ? t('activity.detail.cache.revalidating') : t('activity.detail.cache.degraded');
  const lastUpdated =
    updatedAt === undefined ? undefined : t('activity.cache.lastUpdated', { time: dateFormatter.format(updatedAt) });
  const accessibilityLabel = [title, message, lastUpdated].filter(Boolean).join('. ');

  return (
    <View style={styles.cacheStatus}>
      <View accessible accessibilityLabel={accessibilityLabel}>
        <Text style={styles.cacheStatusTitle}>{title}</Text>
        <Text style={styles.cacheStatusMessage}>{message}</Text>
        {lastUpdated ? <Text style={styles.cacheStatusTimestamp}>{lastUpdated}</Text> : null}
      </View>
      {refreshFailed ? (
        <Pressable
          accessibilityRole="button"
          onPress={onRefresh}
          style={({ pressed }) => [styles.cacheRetry, pressed ? styles.cacheRetryPressed : undefined]}
        >
          <Text style={styles.cacheRetryText}>{t('activity.retry')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function renderEntry(
  entry: HistoryEntry,
  dateFormatter: Intl.DateTimeFormat,
  formatNumber: FormatNumber,
  t: Translate,
  styles: Styles,
  explorerUrl: string | undefined,
  explorerOpenState: 'idle' | 'opening' | 'failed',
  onOpenExplorer: () => void,
  renderAccount: (address: string, label: string) => React.ReactNode,
) {
  const presentation = activityEntryPresentation(entry, t, formatNumber);
  return (
    <View style={styles.ready}>
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Text style={styles.heroGlyph}>
            {entry.kind === 'payment' ? '↔' : entry.kind === 'create-account' ? '+' : '•'}
          </Text>
        </View>
        <Text style={styles.heroTitle}>{presentation.title}</Text>
        <Text style={styles.heroPrimary}>{presentation.primary}</Text>
      </View>

      {entry.kind === 'unsupported' ? (
        <Text style={styles.warning}>
          {t(
            entry.reason === 'operation-shape'
              ? 'activity.detail.warning.unsupportedShape'
              : 'activity.detail.warning.unsupportedType',
          )}
        </Text>
      ) : null}

      <View style={styles.rows}>
        <DetailRow label={t('activity.detail.operationId')} value={entry.id} mono styles={styles} />
        <DetailRow label={t('activity.detail.operationType')} value={entry.operationType} styles={styles} />
        <DetailRow
          label={t('activity.detail.occurredAt')}
          value={dateFormatter.format(new Date(entry.occurredAt))}
          styles={styles}
        />
        <DetailRow label={t('activity.detail.transactionHash')} value={entry.transactionHash} mono styles={styles} />
        {renderAccount(entry.sourceAccount, t('activity.detail.sourceAccount'))}
        {entry.kind === 'trust-authorization' || entry.kind === 'trust-flags' ? (
          <>
            <DetailRow label={t('activity.detail.asset')} value={entry.asset.code} fullValue styles={styles} />
            {renderAccount(entry.asset.issuer, t('activity.detail.issuer'))}
            {renderAccount(entry.trustor, t('activity.trustControl.trustor'))}
            {entry.kind === 'trust-authorization' ? (
              <DetailRow
                label={t('activity.trustControl.authorization')}
                value={t(`activity.trustControl.authorization.${entry.authorization}`)}
                fullValue
                styles={styles}
              />
            ) : (
              <>
                <DetailRow
                  label={t('activity.trustControl.setFlags')}
                  value={
                    entry.setFlags.length
                      ? entry.setFlags.map(flag => t(`activity.trustControl.flag.${flag}`)).join(' / ')
                      : t('activity.trustControl.none')
                  }
                  fullValue
                  styles={styles}
                />
                <DetailRow
                  label={t('activity.trustControl.clearFlags')}
                  value={
                    entry.clearFlags.length
                      ? entry.clearFlags.map(flag => t(`activity.trustControl.flag.${flag}`)).join(' / ')
                      : t('activity.trustControl.none')
                  }
                  fullValue
                  styles={styles}
                />
              </>
            )}
            <Text style={styles.warning}>{t('activity.trustControl.explanation')}</Text>
          </>
        ) : null}
        {entry.kind === 'sponsorship' ? (
          <>
            {renderAccount(entry.sponsor, t('activity.sponsorship.sponsor'))}
            {renderAccount(entry.beneficiary, t('activity.sponsorship.beneficiary'))}
            <Text style={styles.warning}>{t('activity.sponsorship.explanation')}</Text>
          </>
        ) : null}
        {entry.kind === 'failed' ? <Text style={styles.warning}>{t('activity.detail.failed')}</Text> : null}
        {entry.kind === 'account-control' ? (
          <>
            {Object.entries(entry.parameters).map(([key, value]) => <DetailRow key={key} label={t(`activity.control.field.${key}`)} value={Array.isArray(value) ? value.join(', ') || t('activity.trustControl.none') : String(value)} fullValue styles={styles} />)}
            <Text style={styles.warning}>{t(`activity.control.explanation.${entry.operationType}`)}</Text>
          </>
        ) : null}
        {entry.kind === 'maintenance' ? (
          <>
            {entry.dataName === undefined ? null : (
              <DetailRow label={t('activity.maintenance.dataName')} value={entry.dataName} fullValue styles={styles} />
            )}
            {entry.extendTo === undefined ? null : (
              <DetailRow
                label={t('activity.maintenance.extendTo')}
                value={String(entry.extendTo)}
                fullValue
                styles={styles}
              />
            )}
            {entry.bumpTo === undefined ? null : (
              <DetailRow label={t('activity.maintenance.bumpTo')} value={entry.bumpTo} fullValue styles={styles} />
            )}
            <Text style={styles.warning}>{t(`activity.maintenance.explanation.${entry.operationType}`)}</Text>
          </>
        ) : null}
        {entry.kind === 'contract' ? (
          <>
            <DetailRow
              label={t('activity.contract.host')}
              value={t(
                `activity.entry.contract${entry.hostFunction === 'invoke' ? 'Invoke' : entry.hostFunction === 'create' ? 'Create' : entry.hostFunction === 'create-v2' ? 'Constructor' : 'Upload'}`,
              )}
              styles={styles}
            />
            {entry.deployer ? <DetailRow label={t('activity.contract.deployer')} value={entry.deployer} fullValue styles={styles} /> : null}
            {entry.creationAsset ? <DetailRow label={t('activity.contract.originAsset')} value={entry.creationAsset.kind === 'native' ? 'XLM' : `${entry.creationAsset.code}:${entry.creationAsset.issuer}`} fullValue styles={styles} /> : null}
            {entry.creationOrigin ? <Text style={styles.warning}>{t('activity.contract.createdIdUnavailable')}</Text> : null}
            {entry.contractId ? (
              <DetailRow
                label={t('activity.contract.identity')}
                value={entry.contractId}
                mono
                fullValue
                styles={styles}
              />
            ) : null}
            {entry.functionName ? (
              <DetailRow label={t('activity.contract.function')} value={entry.functionName} fullValue styles={styles} />
            ) : null}
            <Text style={styles.warning}>{t('activity.contract.limitation')}</Text>
            {entry.hostFunction !== 'invoke' && entry.hostFunction !== 'create-v2' ? (
              <Text style={styles.warning}>{t('activity.contract.noSummary')}</Text>
            ) : entry.events === undefined ? (
              <Text style={styles.warning}>{t('activity.contract.unavailable')}</Text>
            ) : entry.events.length === 0 ? (
              <Text style={styles.warning}>{t('activity.contract.empty')}</Text>
            ) : null}
            {(entry.events ?? []).map((event, index) => (
              <React.Fragment key={index}>
                <DetailRow
                  label={t('activity.contract.eventType')}
                  value={t(`activity.contract.event.${event.type}`)}
                  styles={styles}
                />
                <DetailRow
                  label={t('activity.contract.quantity')}
                  value={`${formatNumber(event.amount, 7)} ${event.asset.code}`}
                  fullValue
                  styles={styles}
                />
                {event.asset.kind === 'credit' ? (
                  <DetailRow
                    label={t('activity.detail.issuer')}
                    value={event.asset.issuer}
                    mono
                    fullValue
                    styles={styles}
                  />
                ) : null}
                {event.from ? (
                  event.from.startsWith('G') ? (
                    renderAccount(event.from, t('activity.contract.from'))
                  ) : (
                    <DetailRow label={t('activity.contract.from')} value={event.from} mono fullValue styles={styles} />
                  )
                ) : null}
                {event.to ? (
                  event.destinationMuxedId === undefined && event.to.startsWith('G') ? (
                    renderAccount(event.to, t('activity.contract.to'))
                  ) : (
                    <DetailRow label={t('activity.contract.to')} value={event.to} mono fullValue styles={styles} />
                  )
                ) : null}
                <DetailRow
                  label={t('activity.detail.direction')}
                  value={t(`activity.contract.direction.${event.direction}`)}
                  styles={styles}
                />
                {event.destinationMuxedId === undefined ? null : (
                  <DetailRow
                    label={t('activity.contract.routingId')}
                    value={event.destinationMuxedId}
                    mono
                    styles={styles}
                  />
                )}
              </React.Fragment>
            ))}
          </>
        ) : null}
        {entry.kind === 'claimable-create' || entry.kind === 'clawback' ? (
          <>
            <DetailRow
              label={t(
                entry.kind === 'claimable-create'
                  ? 'activity.detail.claimableQuantity'
                  : 'activity.detail.removedQuantity',
              )}
              value={`${formatNumber(entry.amount, 7)} ${entry.asset.code}`}
              styles={styles}
            />
            <DetailRow label={t('activity.detail.asset')} value={entry.asset.code} styles={styles} />
            {entry.asset.kind === 'credit' ? renderAccount(entry.asset.issuer, t('activity.detail.issuer')) : null}
            {entry.kind === 'claimable-create' ? (
              <>
                {renderAccount(entry.sourceAccount, t('activity.detail.creator'))}
                <Text style={styles.warning}>{t('activity.detail.claimableExplanation')}</Text>
                {entry.claimants.map((claimant, index) => (
                  <React.Fragment key={index}>
                    {renderAccount(claimant.destination, t('activity.detail.claimant'))}
                    <DetailRow
                      label={t('activity.detail.condition')}
                      value={claimPredicateSummary(claimant.predicate, t)}
                      fullValue
                      styles={styles}
                    />
                  </React.Fragment>
                ))}
              </>
            ) : (
              <>
                {renderAccount(entry.holder, t('activity.detail.holder'))}
                {entry.holder !== entry.holderBase ? (
                  <DetailRow label={t('activity.detail.holderBase')} value={entry.holderBase} mono styles={styles} />
                ) : null}
                <Text style={styles.warning}>{t('activity.detail.clawbackWarning')}</Text>
              </>
            )}
          </>
        ) : null}
        {entry.kind === 'claimable-reference' ? (
          <>
            {renderAccount(
              entry.sourceAccount,
              t(
                entry.operationType === 'claim_claimable_balance'
                  ? 'activity.detail.claimant'
                  : 'activity.detail.issuer',
              ),
            )}
            <DetailRow label={t('activity.detail.balanceId')} value={entry.balanceId} mono styles={styles} />
            {entry.asset && entry.amount !== undefined ? (
              <>
                <DetailRow label={t(entry.operationType === 'claim_claimable_balance' ? 'activity.detail.claimedQuantity' : 'activity.detail.removedQuantity')} value={`${formatNumber(entry.amount, 7)} ${entry.asset.code}`} fullValue styles={styles} />
                <DetailRow label={t('activity.detail.asset')} value={entry.asset.code} styles={styles} />
                {entry.asset.kind === 'credit' ? renderAccount(entry.asset.issuer, t('activity.detail.issuer')) : null}
                <Text style={styles.warning}>{t('activity.detail.effectsEvidence')}</Text>
              </>
            ) : <Text style={styles.warning}>{t('activity.detail.amountUnavailableExplanation')}</Text>}
            {entry.operationType === 'clawback_claimable_balance' ? (
              <Text style={styles.warning}>{t('activity.detail.clawbackWarning')}</Text>
            ) : null}
          </>
        ) : null}
        {entry.kind === 'offer' ? (
          <>
            <Text style={styles.warning}>{t('activity.detail.offerExplanation')}</Text>
            <DetailRow
              label={t('activity.detail.orderQuantity')}
              value={`${formatNumber(entry.amount, 7)} ${entry.operationType === 'manage_buy_offer' ? entry.buyingAsset.code : entry.sellingAsset.code}`}
              styles={styles}
            />
            <DetailRow label={t('activity.detail.buyingAsset')} value={entry.buyingAsset.code} styles={styles} />
            {entry.buyingAsset.kind === 'credit'
              ? renderAccount(entry.buyingAsset.issuer, t('activity.detail.buyingIssuer'))
              : null}
            <DetailRow label={t('activity.detail.sellingAsset')} value={entry.sellingAsset.code} styles={styles} />
            {entry.sellingAsset.kind === 'credit'
              ? renderAccount(entry.sellingAsset.issuer, t('activity.detail.sellingIssuer'))
              : null}
            <DetailRow
              label={t('activity.detail.orderPrice')}
              value={`${entry.price.n}/${entry.price.d}`}
              styles={styles}
            />
            {entry.offerId === undefined ? null : (
              <DetailRow label={t('activity.detail.offerId')} value={entry.offerId} mono styles={styles} />
            )}
          </>
        ) : null}
        {entry.kind === 'liquidity-pool' ? (
          <>
            <DetailRow label={t('activity.detail.poolId')} value={entry.poolId} mono styles={styles} />
            {entry.reserves.map((leg, index) => (
              <React.Fragment key={index}>
                <DetailRow
                  label={t(
                    entry.operationType === 'liquidity_pool_deposit'
                      ? 'activity.detail.reserveDeposited'
                      : 'activity.detail.reserveReceived',
                  )}
                  value={`${formatNumber(leg.amount, 7)} ${leg.asset.code}`}
                  styles={styles}
                />
                {leg.asset.kind === 'credit' ? renderAccount(leg.asset.issuer, t('activity.detail.issuer')) : null}
              </React.Fragment>
            ))}
            <DetailRow
              label={t(
                entry.operationType === 'liquidity_pool_deposit'
                  ? 'activity.detail.sharesReceived'
                  : 'activity.detail.sharesRedeemed',
              )}
              value={formatNumber(entry.shares, 7)}
              styles={styles}
            />
          </>
        ) : null}
        {entry.kind === 'path-payment' ? (
          <>
            <DetailRow
              label={t('activity.detail.direction')}
              value={directionLabel(entry.direction, t)}
              styles={styles}
            />
            <DetailRow
              label={t('activity.detail.actualSent')}
              value={`${formatNumber(entry.sourceAmount, 7)} ${entry.sourceAsset.code}`}
              styles={styles}
            />
            {entry.sourceAsset.kind === 'credit'
              ? renderAccount(entry.sourceAsset.issuer, t('activity.detail.sourceIssuer'))
              : null}
            <DetailRow
              label={t('activity.detail.actualReceived')}
              value={`${formatNumber(entry.destinationAmount, 7)} ${entry.destinationAsset.code}`}
              styles={styles}
            />
            {entry.destinationAsset.kind === 'credit'
              ? renderAccount(entry.destinationAsset.issuer, t('activity.detail.destinationIssuer'))
              : null}
            <ParticipantRows participants={entry.participants} t={t} renderAccount={renderAccount} />
          </>
        ) : null}
        {entry.kind === 'payment' ? (
          <>
            <DetailRow
              label={t('activity.detail.direction')}
              value={directionLabel(entry.direction, t)}
              styles={styles}
            />
            <DetailRow
              label={t('activity.detail.amount')}
              value={`${formatNumber(entry.amount)} ${entry.asset.code}`}
              styles={styles}
            />
            <DetailRow label={t('activity.detail.asset')} value={entry.asset.code} styles={styles} />
            {entry.asset.kind === 'credit' ? renderAccount(entry.asset.issuer, t('activity.detail.issuer')) : null}
            {renderAccount(entry.counterparty, t('activity.detail.counterparty'))}
            <ParticipantRows participants={entry.participants} t={t} renderAccount={renderAccount} />
          </>
        ) : null}
        {entry.kind === 'create-account' ? (
          <>
            <DetailRow
              label={t('activity.detail.direction')}
              value={directionLabel(entry.direction, t)}
              styles={styles}
            />
            <DetailRow
              label={t('activity.detail.startingBalance')}
              value={`${formatNumber(entry.startingBalance)} XLM`}
              styles={styles}
            />
            {renderAccount(entry.counterparty, t('activity.detail.counterparty'))}
            <ParticipantRows participants={entry.participants} t={t} renderAccount={renderAccount} />
          </>
        ) : null}
        {entry.kind === 'change-trust' ? (
          <>
            <DetailRow label={t('activity.detail.asset')} value={entry.asset.code} styles={styles} />
            {renderAccount(entry.asset.issuer, t('activity.detail.issuer'))}
            <DetailRow label={t('activity.detail.limit')} value={formatNumber(entry.limit)} styles={styles} />
            <ParticipantRows participants={entry.participants} t={t} renderAccount={renderAccount} />
          </>
        ) : null}
      </View>

      <OperationExplorerAction
        failed={explorerOpenState === 'failed'}
        opening={explorerOpenState === 'opening'}
        onOpen={onOpenExplorer}
        styles={styles}
        t={t}
        visible={explorerUrl !== undefined}
      />
    </View>
  );
}

export function OperationExplorerAction({
  visible,
  opening,
  failed,
  onOpen,
  t,
  styles,
}: Readonly<{
  visible: boolean;
  opening: boolean;
  failed: boolean;
  onOpen: () => void;
  t: Translate;
  styles: Styles;
}>) {
  if (!visible) {
    return null;
  }

  const label = opening ? t('activity.detail.explorer.opening') : t('activity.detail.explorer.open');

  return (
    <View style={styles.explorerSection}>
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="button"
        accessibilityState={{ busy: opening, disabled: opening }}
        disabled={opening}
        onPress={onOpen}
        style={({ pressed }) => [
          styles.explorerButton,
          pressed && !opening ? styles.explorerButtonPressed : undefined,
          opening ? styles.explorerButtonDisabled : undefined,
        ]}
      >
        <Text style={styles.explorerButtonText}>{label}</Text>
      </Pressable>
      {failed ? <Text style={styles.explorerError}>{t('activity.detail.explorer.error')}</Text> : null}
    </View>
  );
}

function ParticipantRows({
  participants,
  t,
  renderAccount,
}: Readonly<{
  participants: readonly HistoryParticipant[];
  t: Translate;
  renderAccount: (address: string, label: string) => React.ReactNode;
}>) {
  return participants.map((participant, index) => (
    <React.Fragment key={`${participant.role}:${index}`}>
      {renderAccount(participant.identity, participantRoleLabel(participant.role, t))}
    </React.Fragment>
  ));
}

function DetailRow({
  label,
  value,
  mono = false,
  fullValue = false,
  styles,
}: Readonly<{ label: string; value: string; mono?: boolean; fullValue?: boolean; styles: Styles }>) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text
        numberOfLines={fullValue ? undefined : mono ? 3 : 2}
        selectable
        style={[styles.rowValue, mono ? styles.mono : undefined]}
      >
        {value}
      </Text>
    </View>
  );
}

function participantRoleLabel(role: HistoryParticipantRole, t: Translate): string {
  return t(`activity.detail.participant.${role}`);
}

function directionLabel(direction: HistoryDirection, t: Translate): string {
  return t(`activity.detail.${direction}`);
}

function shortAddress(value: string): string {
  return value.length <= 22 ? value : `${value.slice(0, 9)}…${value.slice(-7)}`;
}
