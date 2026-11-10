import { isPathSwap } from '@capabilities/history/pathPaymentHistory';
import { isNormallyHiddenHistory } from '@capabilities/history/historyDisplayVisibility';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { AccountIdentityCard, Screen } from '@ui/components';
import Svg, { Path } from 'react-native-svg';
import { ActivityFiltersSheet } from './ActivityFiltersSheet';
import { matchesActivityQuantity, type ActivityQuantityFilter } from './activityQuantityFilter';
import { activityDateLabel, localActivityDay } from './activityDate';
import { IdentityAvatar } from '@ui/components/IdentityAvatar';
import { TokenAssetIcon } from '../assets/TokenAssetIcon';
import { NativeButton } from '@ui/components/NativeButton';
import { NativeField } from '@ui/components/NativeField';

import type { AccountRecord } from '@capabilities/account/types';
import {
  cacheHistoryOnlineEntriesBestEffort,
  clearHistoryCacheBestEffort,
  readHistoryCacheSnapshotBestEffort,
  type HistoryProductDependencies,
} from '@capabilities/history/HistoryCacheHydration';
import { loadHistoryPage } from '@capabilities/history/loadHistoryPage';
import type { HistoryEntry } from '@capabilities/history/types';
import { useAppTheme, useThemedStyles } from '@ui/theme';

import { useLocalization } from '../../locale';
import { matchesActivityFilter, matchesActivitySearch, type ActivityFilter } from './activityList';
import { entryAssetIdentities, visibleByAssetPreference } from './activityAssetVisibility';
import {
  appendActivityHistoryPage,
  createActivityReadyState,
  createCachedActivityReadyState,
  failActivityLoadMore,
  failActivityRefresh,
  startActivityLoadMore,
  startActivityRefresh,
  type ActivityReadyState,
} from './activityReadModel';
import { createStyles } from './styles';
import { activityRowPresentation, type ActivityIdentityNames } from './activityRowPresentation';

type ActivityLoadMode = 'hydrate' | 'refresh' | 'revalidate';

type ActivityState =
  | Readonly<{ kind: 'loading' }>
  | Readonly<{ kind: 'inactive' }>
  | Readonly<{ kind: 'unsupported-account' }>
  | Readonly<{ kind: 'offline-empty' }>
  | Readonly<{ kind: 'ready' } & ActivityReadyState>;

type Props = Readonly<{
  account: AccountRecord;
  dependencies: HistoryProductDependencies;
  active: boolean;
  onOpenOperation: (operationId: string) => void;
  onManualRefresh: () => Promise<unknown>;
  invalidationRevision: number;
  identityNames?: ActivityIdentityNames;
}>;

export function ActivityScreen({
  account,
  dependencies,
  active,
  onOpenOperation,
  onManualRefresh,
  invalidationRevision,
  identityNames,
}: Props) {
  const { formatNumber, locale, t } = useLocalization();
  const theme = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const [state, setState] = useState<ActivityState>({ kind: 'loading' });
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const [searchText, setSearchText] = useState('');
  const [headReadPending, setHeadReadPending] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [hiddenAssets, setHiddenAssets] = useState<ReadonlySet<string>>(new Set());
  const [showFailed, setShowFailed] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [quantityFilter, setQuantityFilter] = useState<ActivityQuantityFilter>({});
  const [calendarNow, setCalendarNow] = useState(new Date());
  const requestVersion = useRef(0);
  const hasHydrated = useRef(false);
  const revalidating = useRef(false);

  useEffect(() => {
    setFilter('all');
    setSearchText('');
    setShowHidden(false);
    setHiddenAssets(new Set());
    setShowFailed(false);
    setFiltersOpen(false);
    setQuantityFilter({});
  }, [account.address, account.networkId]);

  useEffect(() => {
    if (!active) {
      setFiltersOpen(false);
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    const updateDay = () => {
      const now = new Date();
      setCalendarNow(now);
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      timer = setTimeout(updateDay, Math.min(60_000, midnight.getTime() - now.getTime() + 20));
    };
    updateDay();
    return () => clearTimeout(timer);
  }, [active]);

  const loadInitial = useCallback(
    (mode: ActivityLoadMode, beforeLoad?: () => Promise<unknown>) => {
      const version = requestVersion.current + 1;
      requestVersion.current = version;
      revalidating.current = true;
      setHeadReadPending(true);

      if (mode === 'hydrate') {
        const snapshot = readHistoryCacheSnapshotBestEffort(dependencies, account);
        setState(snapshot ? { kind: 'ready', ...createCachedActivityReadyState(snapshot) } : { kind: 'loading' });
      } else if (mode === 'revalidate') {
        setState(current =>
          current.kind === 'ready' && (current.loadingMore || current.refreshing)
            ? { ...current, loadingMore: false, refreshing: false }
            : current,
        );
      } else {
        setState(current => (current.kind === 'ready' ? { kind: 'ready', ...startActivityRefresh(current) } : current));
      }

      const before = beforeLoad
        ? Promise.resolve()
            .then(beforeLoad)
            .catch(() => undefined)
        : Promise.resolve();

      void before
        .then(() => loadHistoryPage(dependencies, account))
        .then(page => {
          if (requestVersion.current !== version) {
            return;
          }

          switch (page.status) {
            case 'inactive':
              clearHistoryCacheBestEffort(dependencies, account);
              setState(current => (current.kind === 'inactive' ? current : { kind: 'inactive' }));
              return;
            case 'unsupported-account':
              setState(current => (current.kind === 'unsupported-account' ? current : { kind: 'unsupported-account' }));
              return;
            case 'active': {
              const updatedAt = dependencies.now();
              cacheHistoryOnlineEntriesBestEffort(dependencies, account, page.entries, updatedAt);
              setState(current => {
                if (
                  mode === 'revalidate' &&
                  current.kind === 'ready' &&
                  current.source === 'online' &&
                  page.nextCursor === current.acceptedCursors[0] &&
                  (page.nextCursor !== undefined || page.entries.length === current.entries.length) &&
                  JSON.stringify(page.entries) === JSON.stringify(current.entries.slice(0, page.entries.length))
                )
                  return current.stale || current.refreshFailed
                    ? {
                        ...current,
                        stale: false,
                        refreshFailed: false,
                        refreshing: false,
                        lastSuccessfulHorizonUpdateAt: updatedAt,
                      }
                    : current;
                return { kind: 'ready', ...createActivityReadyState(page, updatedAt) };
              });
              return;
            }
          }
        })
        .catch(() => {
          if (requestVersion.current !== version) {
            return;
          }
          setState(current =>
            current.kind === 'ready'
              ? { kind: 'ready', ...failActivityRefresh(current), stale: mode === 'revalidate' || current.stale }
              : { kind: 'offline-empty' },
          );
        })
        .finally(() => {
          if (requestVersion.current === version) {
            revalidating.current = false;
            setHeadReadPending(false);
          }
        });
    },
    [account, dependencies],
  );

  useEffect(() => {
    if (!active) {
      return;
    }

    const mode: ActivityLoadMode = hasHydrated.current ? 'revalidate' : 'hydrate';
    hasHydrated.current = true;
    loadInitial(mode);
    return () => {
      requestVersion.current += 1;
    };
  }, [active, invalidationRevision, loadInitial]);

  const loadMore = useCallback(() => {
    if (
      revalidating.current ||
      state.kind !== 'ready' ||
      state.source !== 'online' ||
      state.stale ||
      state.loadingMore ||
      state.refreshing ||
      state.nextCursor === undefined
    ) {
      return;
    }

    const version = requestVersion.current;
    const cursor = state.nextCursor;
    setState({ kind: 'ready', ...startActivityLoadMore(state) });

    void loadHistoryPage(dependencies, account, { cursor })
      .then(page => {
        if (requestVersion.current !== version) {
          return;
        }

        if (page.status !== 'active') {
          setState(current =>
            current.kind === 'ready' ? { kind: 'ready', ...failActivityLoadMore(current) } : current,
          );
          return;
        }

        const updatedAt = dependencies.now();
        const next = appendActivityHistoryPage(state, cursor, page, updatedAt);
        if (!next.loadMoreFailed) {
          cacheHistoryOnlineEntriesBestEffort(dependencies, account, next.entries, updatedAt);
        }
        setState({ kind: 'ready', ...next });
      })
      .catch(() => {
        if (requestVersion.current === version) {
          setState(current =>
            current.kind === 'ready' ? { kind: 'ready', ...failActivityLoadMore(current) } : current,
          );
        }
      });
  }, [account, dependencies, state]);

  const visibleEntries = useMemo(() => {
    if (state.kind !== 'ready') {
      return [];
    }

    return state.entries.filter(
      entry =>
        visibleByAssetPreference(entry, hiddenAssets, showHidden) &&
        (showHidden || !isNormallyHiddenHistory(entry, account.address)) &&
        (entry.kind !== 'failed' || showFailed || filter === 'failed') &&
        matchesActivityFilter(entry, filter) &&
        (filter !== 'other' || (entry.kind !== 'offer' && entry.kind !== 'liquidity-pool')) &&
        (filter !== 'payments' || entry.kind !== 'path-payment' || !isPathSwap(entry)) &&
        matchesActivityQuantity(entry, quantityFilter) &&
        matchesActivitySearch(entry, searchText, t, formatNumber, identityNames),
    );
  }, [
    account.address,
    filter,
    formatNumber,
    hiddenAssets,
    identityNames,
    quantityFilter,
    searchText,
    showFailed,
    showHidden,
    state,
    t,
  ]);

  const selectableAssets = useMemo(() => {
    if (state.kind !== 'ready') return [];
    const identities = new Set([...state.entries.flatMap(entryAssetIdentities), ...hiddenAssets]);
    return [...identities].sort();
  }, [hiddenAssets, state]);

  const timeZone = new Intl.DateTimeFormat().resolvedOptions().timeZone;
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        timeZone,
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    [locale, timeZone],
  );
  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        timeZone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    [locale, timeZone],
  );

  const refreshing = state.kind === 'ready' && state.refreshing;

  return (
    <Screen scrollable={false} contentInset="none">
      <View style={styles.header}>
        <View style={styles.headerIdentity}>
          <Text style={styles.title}>{t('activity.title')}</Text>
          <Text numberOfLines={1} style={styles.accountCaption}>
            {account.label || shortAddress(account.address)}
          </Text>
        </View>
        <Pressable
          accessibilityLabel={t('activity.filters.title')}
          accessibilityRole="button"
          accessibilityState={{ expanded: filtersOpen }}
          onPress={() => setFiltersOpen(true)}
          style={({ pressed }) => [styles.headerButton, pressed ? styles.pressed : undefined]}
        >
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" accessible={false}>
            <Path d="M4 6h16M7 12h10M10 18h4" stroke={theme.colors.textPrimary} strokeWidth={2} strokeLinecap="round" />
          </Svg>
        </Pressable>
      </View>

      <View style={styles.controls}>
        <NativeField
          accessibilityHint={t('activity.searchHint')}
          accessibilityLabel={t('activity.searchLabel')}
          autoCapitalize="none"
          autoCorrect={false}
          label={t('activity.searchLabel')}
          onChangeText={setSearchText}
          placeholder={t('activity.searchPlaceholder')}
          returnKeyType="search"
          value={searchText}
        />
        {filter !== 'all' ||
        showHidden ||
        showFailed ||
        hiddenAssets.size > 0 ||
        Object.values(quantityFilter).some(Boolean) ? (
          <View style={styles.activeFilters}>
            {filter !== 'all' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('activity.filters.clearType')}
                onPress={() => setFilter('all')}
                style={styles.filterChip}
              >
                <Text style={styles.filterText}>{t(`activity.filter.${filter}`)} ×</Text>
              </Pressable>
            ) : null}
            {showHidden ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('activity.filters.clearHidden')}
                onPress={() => setShowHidden(false)}
                style={styles.filterChip}
              >
                <Text style={styles.filterText}>{t('activity.visibility.showMarked')} ×</Text>
              </Pressable>
            ) : null}
            {showFailed ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('activity.filters.clearFailed')}
                onPress={() => setShowFailed(false)}
                style={styles.filterChip}
              >
                <Text style={styles.filterText}>{t('activity.filters.showFailed')} ×</Text>
              </Pressable>
            ) : null}
            {(['direction', 'asset', 'comparison', 'amount'] as const).map(key => {
              const value = quantityFilter[key];
              if (!value) return null;
              const label =
                key === 'asset'
                  ? value === 'native:XLM'
                    ? 'XLM'
                    : (JSON.parse(value) as string[]).join(' · ')
                  : key === 'amount'
                    ? value
                    : t(`activity.filters.${value}`);
              return (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  accessibilityLabel={t('activity.filters.remove', { filter: label })}
                  onPress={() => setQuantityFilter(current => ({ ...current, [key]: undefined }))}
                  style={styles.filterChip}
                >
                  <Text style={styles.filterText}>{label} ×</Text>
                </Pressable>
              );
            })}
            {hiddenAssets.size > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('activity.filters.editHidden')}
                onPress={() => setFiltersOpen(true)}
                style={styles.filterChip}
              >
                <Text style={styles.filterText}>{t('activity.filters.hiddenCount', { count: hiddenAssets.size })}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              if (!headReadPending && state.kind !== 'loading') loadInitial('refresh', onManualRefresh);
            }}
            tintColor={theme.colors.actionPrimaryPressed}
          />
        }
      >
        <ActivityContent
          now={calendarNow}
          dateFormatter={dateFormatter}
          entries={visibleEntries}
          identityNames={identityNames}
          formatNumber={formatNumber}
          onLoadMore={loadMore}
          headReadPending={headReadPending}
          onOpenOperation={onOpenOperation}
          onRetry={() => loadInitial('refresh', onManualRefresh)}
          state={state}
          styles={styles}
          t={t}
          timeFormatter={timeFormatter}
          indicatorColor={theme.colors.actionPrimaryPressed}
        />
      </ScrollView>
      {filtersOpen ? (
        <ActivityFiltersSheet
          initial={{ type: filter, showHidden, showFailed, hiddenAssets, quantity: quantityFilter }}
          assets={selectableAssets}
          refreshDisabled={headReadPending || state.kind === 'loading' || refreshing}
          onClose={() => setFiltersOpen(false)}
          onApply={value => {
            setFilter(value.type);
            setShowHidden(value.showHidden);
            setShowFailed(value.showFailed);
            setHiddenAssets(value.hiddenAssets);
            setQuantityFilter(value.quantity);
            setFiltersOpen(false);
          }}
          onRefresh={() => {
            setFiltersOpen(false);
            loadInitial('refresh', onManualRefresh);
          }}
        />
      ) : null}
    </Screen>
  );
}

type Styles = ReturnType<typeof createStyles>;
type Translate = ReturnType<typeof useLocalization>['t'];
type FormatNumber = ReturnType<typeof useLocalization>['formatNumber'];

type ActivityContentProps = Readonly<{
  now?: Date;
  state: ActivityState;
  entries: readonly HistoryEntry[];
  identityNames?: ActivityIdentityNames;
  onRetry: () => void;
  onLoadMore: () => void;
  headReadPending?: boolean;
  onOpenOperation: (operationId: string) => void;
  t: Translate;
  formatNumber: FormatNumber;
  dateFormatter: Intl.DateTimeFormat;
  timeFormatter: Intl.DateTimeFormat;
  indicatorColor: string;
  styles: Styles;
}>;

export function ActivityContent({
  now = new Date(),
  state,
  entries,
  identityNames,
  onRetry,
  onLoadMore,
  headReadPending = false,
  onOpenOperation,
  t,
  formatNumber,
  dateFormatter,
  timeFormatter,
  indicatorColor,
  styles,
}: ActivityContentProps) {
  switch (state.kind) {
    case 'loading':
      return (
        <StatePanel
          loading
          message={t('activity.state.loadingMessage')}
          styles={styles}
          title={t('activity.state.loadingTitle')}
          indicatorColor={indicatorColor}
        />
      );
    case 'inactive':
      return (
        <StatePanel
          action={t('activity.retry')}
          message={t('activity.state.inactiveMessage')}
          onAction={onRetry}
          styles={styles}
          title={t('activity.state.inactiveTitle')}
          indicatorColor={indicatorColor}
        />
      );
    case 'unsupported-account':
      return (
        <StatePanel
          message={t('activity.state.unsupportedMessage')}
          styles={styles}
          title={t('activity.state.unsupportedTitle')}
          indicatorColor={indicatorColor}
        />
      );
    case 'offline-empty':
      return (
        <StatePanel
          action={t('activity.retry')}
          message={t('activity.state.offlineEmptyMessage')}
          onAction={onRetry}
          styles={styles}
          title={t('activity.state.offlineEmptyTitle')}
          indicatorColor={indicatorColor}
        />
      );
    case 'ready': {
      const cacheStatus = state.stale ? (
        <CacheStatus
          dateFormatter={dateFormatter}
          refreshing={state.refreshing}
          refreshFailed={state.refreshFailed}
          source={state.source}
          styles={styles}
          t={t}
          timeFormatter={timeFormatter}
          updatedAt={state.lastSuccessfulHorizonUpdateAt}
        />
      ) : null;
      const refreshFailure = state.refreshFailed ? (
        <>
          <Text style={styles.loadMoreError}>
            {state.stale ? t('activity.cache.refreshFailed') : t('activity.state.errorMessage')}
          </Text>
          <NativeButton label={t('activity.retry')} onPress={onRetry} size="sm" variant="secondary" />
        </>
      ) : null;

      const paginationDisabled = headReadPending || state.loadingMore || state.refreshing || state.stale;
      const loadMoreAction =
        state.nextCursor !== undefined ? (
          <Pressable
            accessibilityLabel={t('activity.loadOlder')}
            accessibilityRole="button"
            accessibilityState={{ disabled: paginationDisabled, busy: headReadPending || state.loadingMore }}
            disabled={paginationDisabled}
            onPress={onLoadMore}
            style={({ pressed }) => [
              styles.loadMoreButton,
              pressed ? styles.pressed : undefined,
              paginationDisabled ? styles.disabled : undefined,
            ]}
          >
            {state.loadingMore ? (
              <ActivityIndicator color={indicatorColor} />
            ) : (
              <Text style={styles.loadMoreText}>{t('activity.loadOlder')}</Text>
            )}
          </Pressable>
        ) : null;

      if (state.entries.length === 0) {
        return (
          <>
            {cacheStatus}
            {refreshFailure}
            <StatePanel
              message={t('activity.state.emptyMessage')}
              styles={styles}
              title={t('activity.state.emptyTitle')}
              indicatorColor={indicatorColor}
            />
          </>
        );
      }

      if (entries.length === 0) {
        return (
          <>
            {cacheStatus}
            {refreshFailure}
            <StatePanel
              message={t('activity.state.noMatchMessage')}
              styles={styles}
              title={t('activity.state.noMatchTitle')}
              indicatorColor={indicatorColor}
            />
            {state.loadMoreFailed ? <Text style={styles.loadMoreError}>{t('activity.loadMoreError')}</Text> : null}
            {loadMoreAction}
          </>
        );
      }

      return (
        <>
          {cacheStatus}
          {refreshFailure}
          {renderEntries(
            entries,
            t,
            formatNumber,
            dateFormatter,
            timeFormatter,
            onOpenOperation,
            styles,
            identityNames,
            now,
          )}
          {state.loadMoreFailed ? <Text style={styles.loadMoreError}>{t('activity.loadMoreError')}</Text> : null}
          {loadMoreAction}
        </>
      );
    }
  }
}

function CacheStatus({
  source,
  refreshing,
  refreshFailed,
  updatedAt,
  dateFormatter,
  timeFormatter,
  t,
  styles,
}: Readonly<{
  source: ActivityReadyState['source'];
  refreshing: boolean;
  refreshFailed: boolean;
  updatedAt?: Date;
  dateFormatter: Intl.DateTimeFormat;
  timeFormatter: Intl.DateTimeFormat;
  t: Translate;
  styles: Styles;
}>) {
  const title = source === 'cache' ? t('activity.cache.cachedTitle') : t('activity.cache.staleTitle');
  const message = refreshing
    ? t('activity.cache.revalidating')
    : refreshFailed
      ? t('activity.cache.degraded')
      : t('activity.cache.staleMessage');
  const lastUpdated =
    updatedAt === undefined
      ? undefined
      : t('activity.cache.lastUpdated', {
          time: `${dateFormatter.format(updatedAt)} ${timeFormatter.format(updatedAt)}`,
        });
  const accessibilityLabel = [title, message, lastUpdated].filter(Boolean).join('. ');

  return (
    <View accessible accessibilityLabel={accessibilityLabel} style={styles.cacheStatus}>
      <Text style={styles.cacheStatusTitle}>{title}</Text>
      <Text style={styles.cacheStatusMessage}>{message}</Text>
      {lastUpdated ? <Text style={styles.cacheStatusTimestamp}>{lastUpdated}</Text> : null}
    </View>
  );
}

function renderEntries(
  entries: readonly HistoryEntry[],
  t: Translate,
  formatNumber: FormatNumber,
  dateFormatter: Intl.DateTimeFormat,
  timeFormatter: Intl.DateTimeFormat,
  onOpenOperation: (operationId: string) => void,
  styles: Styles,
  identityNames?: ActivityIdentityNames,
  now = new Date(),
) {
  let previousDate = '';

  return entries.map(entry => {
    const date = new Date(entry.occurredAt);
    const day = localActivityDay(date);
    const dateLabel = activityDateLabel(date, now, dateFormatter, t);
    const showDate = day !== previousDate;
    previousDate = day;

    return (
      <React.Fragment key={entry.id}>
        {showDate ? (
          <Text accessibilityRole="header" style={styles.dateHeader}>
            {dateLabel}
          </Text>
        ) : null}
        <ActivityRow
          entry={entry}
          identityNames={identityNames}
          formatNumber={formatNumber}
          onOpen={() => onOpenOperation(entry.id)}
          styles={styles}
          t={t}
          timeFormatter={timeFormatter}
        />
      </React.Fragment>
    );
  });
}

export function ActivityRow({
  entry,
  formatNumber,
  onOpen,
  styles,
  t,
  timeFormatter,
  identityNames,
}: Readonly<{
  entry: HistoryEntry;
  formatNumber: FormatNumber;
  onOpen: () => void;
  styles: Styles;
  t: Translate;
  timeFormatter: Intl.DateTimeFormat;
  identityNames?: ActivityIdentityNames;
}>) {
  const presentation = activityRowPresentation(entry, t, formatNumber, identityNames);
  const secondary = `${presentation.operation} · ${timeFormatter.format(new Date(entry.occurredAt))}`;
  const amounts = presentation.reserveMoney ?? (presentation.money ? [presentation.money] : []);
  return (
    <Pressable
      accessible
      accessibilityLabel={[
        presentation.title,
        secondary,
        ...amounts.map(money => `${money.amount} ${money.asset.code}`),
      ]
        .filter(Boolean)
        .join(', ')}
      accessibilityRole="button"
      onPress={onOpen}
      style={({ pressed }) => [styles.activityRow, pressed ? styles.pressed : undefined]}
    >
      {presentation.subject.kind === 'account' ? (
        <AccountIdentityCard
          address={presentation.subject.address}
          name={presentation.title}
          label={presentation.operation}
          presentation="compact"
          secondary={secondary}
        />
      ) : (
        <View style={styles.activitySubject}>
          {presentation.subject.kind === 'asset-pair' ? (
            <View style={styles.assetPair}>
              <TokenAssetIcon asset={presentation.subject.source} small />
              <TokenAssetIcon asset={presentation.subject.destination} small />
            </View>
          ) : presentation.subject.kind === 'contract' ? (
            <IdentityAvatar identity={`contract:${presentation.subject.identity}`} />
          ) : presentation.subject.kind === 'reference' ? (
            <IdentityAvatar identity={`claimable:${presentation.subject.identity}`} />
          ) : presentation.subject.kind === 'asset' ? (
            <TokenAssetIcon asset={presentation.subject.asset} />
          ) : (
            <View
              accessible={false}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={styles.operationIcon}
            >
              <Text style={styles.operationGlyph}>•</Text>
            </View>
          )}
          <View style={styles.activityIdentity}>
            <Text numberOfLines={1} ellipsizeMode="middle" style={styles.activityTitle}>
              {presentation.title}
            </Text>
            <Text numberOfLines={1} ellipsizeMode="tail" style={styles.activitySecondary}>
              {secondary}
            </Text>
          </View>
        </View>
      )}
      {amounts.length ? (
        <View style={styles.activityTrailing}>
          {amounts.map((money, index) => (
            <View key={index}>
              <Text
                style={[
                  styles.activityAmount,
                  money.tone === 'positive'
                    ? styles.amountPositive
                    : money.tone === 'negative'
                      ? styles.amountNegative
                      : undefined,
                ]}
              >
                {money.amount}
              </Text>
              <View style={styles.assetCaption}>
                <Text style={styles.activityAsset}>{money.asset.code}</Text>
                <TokenAssetIcon asset={money.asset} small />
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

export function StatePanel({
  title,
  message,
  action,
  onAction,
  loading = false,
  indicatorColor,
  styles,
}: Readonly<{
  title: string;
  message: string;
  action?: string;
  onAction?: () => void;
  loading?: boolean;
  indicatorColor: string;
  styles: Styles;
}>) {
  return (
    <View style={styles.statePanel}>
      {loading ? (
        <ActivityIndicator color={indicatorColor} />
      ) : (
        <View style={styles.emptyIcon}>
          <Text style={styles.emptyGlyph}>◎</Text>
        </View>
      )}
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateMessage}>{message}</Text>
      {action && onAction ? <NativeButton label={action} onPress={onAction} size="sm" variant="secondary" /> : null}
    </View>
  );
}

function shortAddress(value: string): string {
  if (value.length <= 22) {
    return value;
  }
  return `${value.slice(0, 9)}…${value.slice(-7)}`;
}
