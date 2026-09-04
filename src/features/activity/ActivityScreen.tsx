import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import type {AccountRecord} from '@capabilities/account/types';
import {
  loadHistoryPage,
  type HistoryDependencies,
} from '@capabilities/history/loadHistoryPage';
import type {HistoryEntry} from '@capabilities/history/types';
import {useAppTheme, useThemedStyles} from '@ui/theme';

import {useLocalization} from '../../locale';
import {
  activityEntryPresentation,
  matchesActivityFilter,
  mergeActivityEntries,
  type ActivityFilter,
  type ActivityTone,
} from './activityList';
import {createStyles} from './styles';

type ActivityState =
  | Readonly<{kind: 'loading'}>
  | Readonly<{kind: 'inactive'}>
  | Readonly<{kind: 'unsupported-account'}>
  | Readonly<{kind: 'error'}>
  | Readonly<{
      kind: 'ready';
      entries: readonly HistoryEntry[];
      nextCursor?: string;
      refreshing: boolean;
      loadingMore: boolean;
      loadMoreFailed: boolean;
    }>;

type Props = Readonly<{
  account: AccountRecord;
  dependencies: HistoryDependencies;
}>;

const FILTERS: readonly ActivityFilter[] = ['all', 'payments', 'accounts', 'other'];
const FILTER_LABEL_KEYS: Readonly<Record<ActivityFilter, string>> = {
  all: 'activity.filter.all',
  payments: 'activity.filter.payments',
  accounts: 'activity.filter.accounts',
  other: 'activity.filter.other',
};

export function ActivityScreen({account, dependencies}: Props) {
  const {formatNumber, locale, t} = useLocalization();
  const theme = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const [state, setState] = useState<ActivityState>({kind: 'loading'});
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const [searchText, setSearchText] = useState('');
  const requestVersion = useRef(0);

  const loadInitial = useCallback(
    (refreshing: boolean) => {
      const version = requestVersion.current + 1;
      requestVersion.current = version;

      if (refreshing) {
        setState(current =>
          current.kind === 'ready'
            ? {...current, refreshing: true, loadMoreFailed: false}
            : {kind: 'loading'},
        );
      } else {
        setState({kind: 'loading'});
      }

      void loadHistoryPage(dependencies, account)
        .then(page => {
          if (requestVersion.current !== version) {
            return;
          }

          switch (page.status) {
            case 'inactive':
              setState({kind: 'inactive'});
              return;
            case 'unsupported-account':
              setState({kind: 'unsupported-account'});
              return;
            case 'active':
              setState({
                kind: 'ready',
                entries: page.entries,
                ...(page.nextCursor === undefined ? {} : {nextCursor: page.nextCursor}),
                refreshing: false,
                loadingMore: false,
                loadMoreFailed: false,
              });
              return;
          }
        })
        .catch(() => {
          if (requestVersion.current === version) {
            setState({kind: 'error'});
          }
        });
    },
    [account, dependencies],
  );

  useEffect(() => {
    loadInitial(false);
    return () => {
      requestVersion.current += 1;
    };
  }, [loadInitial]);

  const loadMore = useCallback(() => {
    if (
      state.kind !== 'ready' ||
      state.loadingMore ||
      state.refreshing ||
      state.nextCursor === undefined
    ) {
      return;
    }

    const version = requestVersion.current;
    const cursor = state.nextCursor;
    setState({...state, loadingMore: true, loadMoreFailed: false});

    void loadHistoryPage(dependencies, account, {cursor})
      .then(page => {
        if (requestVersion.current !== version) {
          return;
        }

        if (page.status !== 'active') {
          setState(current =>
            current.kind === 'ready'
              ? {...current, loadingMore: false, loadMoreFailed: true}
              : current,
          );
          return;
        }

        setState(current => {
          if (current.kind !== 'ready') {
            return current;
          }
          return {
            kind: 'ready',
            entries: mergeActivityEntries(current.entries, page.entries),
            ...(page.nextCursor === undefined ? {} : {nextCursor: page.nextCursor}),
            refreshing: false,
            loadingMore: false,
            loadMoreFailed: false,
          };
        });
      })
      .catch(() => {
        if (requestVersion.current === version) {
          setState(current =>
            current.kind === 'ready'
              ? {...current, loadingMore: false, loadMoreFailed: true}
              : current,
          );
        }
      });
  }, [account, dependencies, state]);

  const visibleEntries = useMemo(() => {
    if (state.kind !== 'ready') {
      return [];
    }

    const query = searchText.trim().toLowerCase();
    return state.entries.filter(entry => {
      if (!matchesActivityFilter(entry, filter)) {
        return false;
      }
      if (!query) {
        return true;
      }

      const presentation = activityEntryPresentation(entry, t, formatNumber);
      return [
        presentation.title,
        presentation.primary,
        presentation.secondary,
        entry.transactionHash,
      ].some(value => value.toLowerCase().includes(query));
    });
  }, [filter, formatNumber, searchText, state, t]);

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    [locale],
  );
  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        hour: '2-digit',
        minute: '2-digit',
      }),
    [locale],
  );

  const refreshing = state.kind === 'ready' && state.refreshing;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerIdentity}>
          <Text style={styles.title}>{t('activity.title')}</Text>
          <Text numberOfLines={1} style={styles.accountCaption}>
            {account.label || shortAddress(account.address)}
          </Text>
        </View>
        <Pressable
          accessibilityLabel={t('activity.refresh')}
          accessibilityRole="button"
          disabled={state.kind === 'loading' || refreshing}
          onPress={() => loadInitial(true)}
          style={({pressed}) => [
            styles.headerButton,
            pressed ? styles.pressed : undefined,
            state.kind === 'loading' || refreshing ? styles.disabled : undefined,
          ]}>
          {refreshing ? (
            <ActivityIndicator color={theme.colors.actionPrimaryPressed} />
          ) : (
            <Text style={styles.headerButtonText}>↻</Text>
          )}
        </Pressable>
      </View>

      <View style={styles.controls}>
        <View style={styles.searchBox}>
          <Text style={styles.searchGlyph}>⌕</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setSearchText}
            placeholder={t('activity.searchPlaceholder')}
            placeholderTextColor={theme.colors.textTertiary}
            returnKeyType="search"
            style={styles.searchInput}
            value={searchText}
          />
        </View>
        <ScrollView
          contentContainerStyle={styles.filters}
          horizontal
          showsHorizontalScrollIndicator={false}>
          {FILTERS.map(item => {
            const selected = filter === item;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{selected}}
                key={item}
                onPress={() => setFilter(item)}
                style={({pressed}) => [
                  styles.filterChip,
                  selected ? styles.filterChipSelected : undefined,
                  pressed ? styles.pressed : undefined,
                ]}>
                <Text
                  style={[
                    styles.filterText,
                    selected ? styles.filterTextSelected : undefined,
                  ]}>
                  {t(FILTER_LABEL_KEYS[item])}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}>
        <ActivityContent
          dateFormatter={dateFormatter}
          entries={visibleEntries}
          filter={filter}
          formatNumber={formatNumber}
          onLoadMore={loadMore}
          onRetry={() => loadInitial(true)}
          searchText={searchText}
          state={state}
          styles={styles}
          t={t}
          timeFormatter={timeFormatter}
          indicatorColor={theme.colors.actionPrimaryPressed}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

type Styles = ReturnType<typeof createStyles>;
type Translate = ReturnType<typeof useLocalization>['t'];
type FormatNumber = ReturnType<typeof useLocalization>['formatNumber'];

type ActivityContentProps = Readonly<{
  state: ActivityState;
  entries: readonly HistoryEntry[];
  filter: ActivityFilter;
  searchText: string;
  onRetry: () => void;
  onLoadMore: () => void;
  t: Translate;
  formatNumber: FormatNumber;
  dateFormatter: Intl.DateTimeFormat;
  timeFormatter: Intl.DateTimeFormat;
  indicatorColor: string;
  styles: Styles;
}>;

function ActivityContent({
  state,
  entries,
  filter,
  searchText,
  onRetry,
  onLoadMore,
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
    case 'error':
      return (
        <StatePanel
          action={t('activity.retry')}
          message={t('activity.state.errorMessage')}
          onAction={onRetry}
          styles={styles}
          title={t('activity.state.errorTitle')}
          indicatorColor={indicatorColor}
        />
      );
    case 'ready':
      if (entries.length === 0) {
        const constrained = filter !== 'all' || searchText.trim().length > 0;
        return (
          <StatePanel
            message={
              constrained
                ? t('activity.state.noMatchMessage')
                : t('activity.state.emptyMessage')
            }
            styles={styles}
            title={
              constrained ? t('activity.state.noMatchTitle') : t('activity.state.emptyTitle')
            }
            indicatorColor={indicatorColor}
          />
        );
      }

      return (
        <>
          {renderEntries(entries, t, formatNumber, dateFormatter, timeFormatter, styles)}
          {state.loadMoreFailed ? (
            <Text style={styles.loadMoreError}>{t('activity.loadMoreError')}</Text>
          ) : null}
          {state.nextCursor !== undefined ? (
            <Pressable
              disabled={state.loadingMore || state.refreshing}
              onPress={onLoadMore}
              style={({pressed}) => [
                styles.loadMoreButton,
                pressed ? styles.pressed : undefined,
                state.loadingMore || state.refreshing ? styles.disabled : undefined,
              ]}>
              {state.loadingMore ? (
                <ActivityIndicator color={indicatorColor} />
              ) : (
                <Text style={styles.loadMoreText}>{t('activity.loadOlder')}</Text>
              )}
            </Pressable>
          ) : null}
        </>
      );
  }
}

function renderEntries(
  entries: readonly HistoryEntry[],
  t: Translate,
  formatNumber: FormatNumber,
  dateFormatter: Intl.DateTimeFormat,
  timeFormatter: Intl.DateTimeFormat,
  styles: Styles,
) {
  let previousDate = '';

  return entries.map(entry => {
    const dateLabel = dateFormatter.format(new Date(entry.occurredAt));
    const showDate = dateLabel !== previousDate;
    previousDate = dateLabel;

    return (
      <React.Fragment key={entry.id}>
        {showDate ? <Text style={styles.dateHeader}>{dateLabel}</Text> : null}
        <ActivityRow
          entry={entry}
          formatNumber={formatNumber}
          styles={styles}
          t={t}
          timeFormatter={timeFormatter}
        />
      </React.Fragment>
    );
  });
}

function ActivityRow({
  entry,
  formatNumber,
  styles,
  t,
  timeFormatter,
}: Readonly<{
  entry: HistoryEntry;
  formatNumber: FormatNumber;
  styles: Styles;
  t: Translate;
  timeFormatter: Intl.DateTimeFormat;
}>) {
  const presentation = activityEntryPresentation(entry, t, formatNumber);
  const glyph = presentation.tone === 'positive' ? '↙' : presentation.tone === 'negative' ? '↗' : '•';

  return (
    <View style={styles.activityRow}>
      <View style={styles.operationIcon}>
        <Text
          style={[
            styles.operationGlyph,
            toneStyle(presentation.tone, styles, 'glyph'),
          ]}>
          {glyph}
        </Text>
      </View>
      <View style={styles.activityIdentity}>
        <Text style={styles.activityTitle}>{presentation.title}</Text>
        <Text numberOfLines={1} style={styles.activitySecondary}>
          {shortAddress(presentation.secondary)}
        </Text>
        <Text style={styles.activityTime}>
          {timeFormatter.format(new Date(entry.occurredAt))}
        </Text>
      </View>
      <Text
        numberOfLines={1}
        style={[
          styles.activityAmount,
          toneStyle(presentation.tone, styles, 'amount'),
        ]}>
        {presentation.primary}
      </Text>
    </View>
  );
}

function toneStyle(tone: ActivityTone, styles: Styles, target: 'glyph' | 'amount') {
  if (tone === 'positive') {
    return target === 'glyph' ? styles.operationGlyphPositive : styles.amountPositive;
  }
  if (tone === 'negative') {
    return target === 'glyph' ? styles.operationGlyphNegative : styles.amountNegative;
  }
  return undefined;
}

function StatePanel({
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
      {action && onAction ? (
        <Pressable
          onPress={onAction}
          style={({pressed}) => [styles.stateAction, pressed ? styles.pressed : undefined]}>
          <Text style={styles.stateActionText}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function shortAddress(value: string): string {
  if (value.length <= 22) {
    return value;
  }
  return `${value.slice(0, 9)}…${value.slice(-7)}`;
}
