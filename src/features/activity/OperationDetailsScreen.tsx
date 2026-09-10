import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Pressable, ScrollView, Text, View} from 'react-native';

import type {AccountRecord} from '@capabilities/account/types';
import {
  loadHistoryOperationDetails,
  type HistoryOperationDetails,
} from '@capabilities/history/loadHistoryOperationDetails';
import type {HistoryDependencies} from '@capabilities/history/loadHistoryPage';
import type {HistoryDirection, HistoryEntry} from '@capabilities/history/types';
import {Header, Screen, StateView} from '@ui/components';
import {useThemedStyles} from '@ui/theme';

import {useLocalization} from '../../locale';
import {projectFeatureError} from '../featureError';
import {activityEntryPresentation} from './activityList';
import {createStyles} from './OperationDetailsScreen.styles';

type LoadState =
  | Readonly<{kind: 'loading'}>
  | Readonly<{kind: 'error'; message: string}>
  | Readonly<{kind: 'loaded'; result: HistoryOperationDetails}>;

type Props = Readonly<{
  account: AccountRecord;
  operationId: string;
  dependencies: HistoryDependencies;
  active: boolean;
  invalidationRevision: number;
  onBack: () => void;
}>;

export function OperationDetailsScreen({
  account,
  operationId,
  dependencies,
  active,
  invalidationRevision,
  onBack,
}: Props) {
  const {formatNumber, locale, t} = useLocalization();
  const styles = useThemedStyles(createStyles);
  const [state, setState] = useState<LoadState>({kind: 'loading'});
  const requestVersion = useRef(0);

  const load = useCallback(() => {
    const version = requestVersion.current + 1;
    requestVersion.current = version;
    setState({kind: 'loading'});

    void loadHistoryOperationDetails(dependencies, account, operationId)
      .then(result => {
        if (requestVersion.current === version) {
          setState({kind: 'loaded', result});
        }
      })
      .catch(error => {
        if (requestVersion.current === version) {
          setState({
            kind: 'error',
            message: projectFeatureError(error, {
              fallbackMessage: t('activity.detail.errorMessage'),
              fallbackRetryable: true,
            }).message,
          });
        }
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

  return (
    <Screen scrollable={false} contentInset="none">
      <View style={styles.headerBar}>
        <Header
          title={t('activity.detail.title')}
          subtitle={account.label || shortAddress(account.address)}
          leading={
            <Pressable accessibilityLabel={t('common.back')} accessibilityRole="button" onPress={onBack} style={styles.backButton}>
              <Text style={styles.backGlyph}>‹</Text>
            </Pressable>
          }
        />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {renderContent(state, load, dateFormatter, formatNumber, t, styles)}
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
) {
  if (state.kind === 'loading') {
    return <StateView kind="loading" title={t('activity.detail.title')} message={t('activity.detail.loadingMessage')} />;
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
      return renderEntry(state.result.entry, dateFormatter, formatNumber, t, styles);
  }
}

function renderEntry(
  entry: HistoryEntry,
  dateFormatter: Intl.DateTimeFormat,
  formatNumber: FormatNumber,
  t: Translate,
  styles: Styles,
) {
  const presentation = activityEntryPresentation(entry, t, formatNumber);
  return (
    <View style={styles.ready}>
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Text style={styles.heroGlyph}>{entry.kind === 'payment' ? '↔' : entry.kind === 'create-account' ? '+' : '•'}</Text>
        </View>
        <Text style={styles.heroTitle}>{presentation.title}</Text>
        <Text style={styles.heroPrimary}>{presentation.primary}</Text>
      </View>

      <View style={styles.rows}>
        <DetailRow label={t('activity.detail.operationId')} value={entry.id} mono styles={styles} />
        <DetailRow label={t('activity.detail.operationType')} value={entry.operationType} styles={styles} />
        <DetailRow label={t('activity.detail.occurredAt')} value={dateFormatter.format(new Date(entry.occurredAt))} styles={styles} />
        <DetailRow label={t('activity.detail.transactionHash')} value={entry.transactionHash} mono styles={styles} />
        <DetailRow label={t('activity.detail.sourceAccount')} value={entry.sourceAccount} mono styles={styles} />
        {entry.kind === 'payment' ? (
          <>
            <DetailRow label={t('activity.detail.direction')} value={directionLabel(entry.direction, t)} styles={styles} />
            <DetailRow label={t('activity.detail.amount')} value={`${formatNumber(entry.amount)} ${entry.asset.code}`} styles={styles} />
            <DetailRow label={t('activity.detail.asset')} value={entry.asset.code} styles={styles} />
            {entry.asset.kind === 'credit' ? <DetailRow label={t('activity.detail.issuer')} value={entry.asset.issuer} mono styles={styles} /> : null}
            <DetailRow label={t('activity.detail.counterparty')} value={entry.counterparty} mono styles={styles} />
          </>
        ) : null}
        {entry.kind === 'create-account' ? (
          <>
            <DetailRow label={t('activity.detail.direction')} value={directionLabel(entry.direction, t)} styles={styles} />
            <DetailRow label={t('activity.detail.startingBalance')} value={`${formatNumber(entry.startingBalance)} XLM`} styles={styles} />
            <DetailRow label={t('activity.detail.counterparty')} value={entry.counterparty} mono styles={styles} />
          </>
        ) : null}
      </View>
    </View>
  );
}

function DetailRow({label, value, mono = false, styles}: Readonly<{label: string; value: string; mono?: boolean; styles: Styles}>) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text numberOfLines={mono ? 3 : 2} selectable style={[styles.rowValue, mono ? styles.mono : undefined]}>
        {value}
      </Text>
    </View>
  );
}

function directionLabel(direction: HistoryDirection, t: Translate): string {
  return t(`activity.detail.${direction}`);
}

function shortAddress(value: string): string {
  return value.length <= 22 ? value : `${value.slice(0, 9)}…${value.slice(-7)}`;
}
