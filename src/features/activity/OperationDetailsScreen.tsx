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

  const load = useCallback(() => {
    const version = requestVersion.current + 1;
    requestVersion.current = version;

    const snapshot = readHistoryCacheSnapshotBestEffort(dependencies, account);
    const cachedEntry = readCachedHistoryDetail(snapshot, operationId);
    setState(current => {
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
      if (current.kind === 'loaded' && current.result.status === 'ready') {
        return {
          ...current,
          stale: true,
          refreshing: true,
          refreshFailed: false,
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

        setState({
          kind: 'loaded',
          result,
          source: 'online',
          stale: false,
          refreshing: false,
          refreshFailed: false,
        });
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
  }, [account, dependencies, operationId, t]);

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
          state,
          load,
          dateFormatter,
          formatNumber,
          t,
          styles,
          explorerUrl,
          explorerOpenState,
          openExplorer,
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
        <DetailRow label={t('activity.detail.sourceAccount')} value={entry.sourceAccount} mono styles={styles} />
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
            {entry.asset.kind === 'credit' ? (
              <DetailRow label={t('activity.detail.issuer')} value={entry.asset.issuer} mono styles={styles} />
            ) : null}
            <DetailRow label={t('activity.detail.counterparty')} value={entry.counterparty} mono styles={styles} />
            <ParticipantRows participants={entry.participants} t={t} styles={styles} />
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
            <DetailRow label={t('activity.detail.counterparty')} value={entry.counterparty} mono styles={styles} />
            <ParticipantRows participants={entry.participants} t={t} styles={styles} />
          </>
        ) : null}
        {entry.kind === 'change-trust' ? (
          <>
            <DetailRow label={t('activity.detail.asset')} value={entry.asset.code} styles={styles} />
            <DetailRow label={t('activity.detail.issuer')} value={entry.asset.issuer} mono styles={styles} />
            <DetailRow label={t('activity.detail.limit')} value={formatNumber(entry.limit)} styles={styles} />
            <ParticipantRows participants={entry.participants} t={t} styles={styles} />
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
  styles,
}: Readonly<{
  participants: readonly HistoryParticipant[];
  t: Translate;
  styles: Styles;
}>) {
  return participants.map((participant, index) => (
    <DetailRow
      key={`${participant.role}:${index}`}
      label={participantRoleLabel(participant.role, t)}
      value={participant.identity}
      mono
      styles={styles}
    />
  ));
}

function DetailRow({
  label,
  value,
  mono = false,
  styles,
}: Readonly<{ label: string; value: string; mono?: boolean; styles: Styles }>) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text numberOfLines={mono ? 3 : 2} selectable style={[styles.rowValue, mono ? styles.mono : undefined]}>
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
