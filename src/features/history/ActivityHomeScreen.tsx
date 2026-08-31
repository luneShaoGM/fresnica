import React, {useCallback, useEffect, useRef, useState} from 'react';
import {ActivityIndicator, StyleSheet, Text, View} from 'react-native';

import type {AccountRecord} from '../../capabilities/account/types';
import {
  loadHistoryPage,
  type HistoryDependencies,
} from '../../capabilities/history/loadHistoryPage';
import type {HistoryEntry} from '../../capabilities/history/types';
import {Button} from '../../ui/Button';
import {Card} from '../../ui/Card';
import {Screen} from '../../ui/Screen';
import {palette, spacing, typography} from '../../ui/theme';
import {historyEntryPresentation, mergeHistoryEntries} from './historyList';

type HistoryState =
  | Readonly<{kind: 'loading'}>
  | Readonly<{kind: 'inactive'}>
  | Readonly<{kind: 'unsupported-account'}>
  | Readonly<{kind: 'error'; message: string}>
  | Readonly<{
      kind: 'ready';
      entries: readonly HistoryEntry[];
      nextCursor?: string;
      refreshing: boolean;
      loadingMore: boolean;
      loadMoreError?: string;
    }>;

type Props = Readonly<{
  account: AccountRecord;
  dependencies: HistoryDependencies;
}>;

export function ActivityHomeScreen({account, dependencies}: Props) {
  const [state, setState] = useState<HistoryState>({kind: 'loading'});
  const requestVersion = useRef(0);

  const loadInitial = useCallback(
    (refreshing: boolean) => {
      const version = requestVersion.current + 1;
      requestVersion.current = version;

      if (refreshing) {
        setState(current =>
          current.kind === 'ready'
            ? {...current, refreshing: true, loadMoreError: undefined}
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
                ...(page.nextCursor === undefined
                  ? {}
                  : {nextCursor: page.nextCursor}),
                refreshing: false,
                loadingMore: false,
              });
              return;
          }
        })
        .catch(error => {
          if (requestVersion.current === version) {
            setState({kind: 'error', message: readableError(error)});
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
    setState({...state, loadingMore: true, loadMoreError: undefined});

    void loadHistoryPage(dependencies, account, {cursor})
      .then(page => {
        if (requestVersion.current !== version) {
          return;
        }

        if (page.status !== 'active') {
          throw new Error(
            page.status === 'inactive'
              ? 'history-account-became-inactive'
              : 'history-account-type-changed',
          );
        }

        setState(current => {
          if (current.kind !== 'ready') {
            return current;
          }
          return {
            kind: 'ready',
            entries: mergeHistoryEntries(current.entries, page.entries),
            ...(page.nextCursor === undefined
              ? {}
              : {nextCursor: page.nextCursor}),
            refreshing: false,
            loadingMore: false,
          };
        });
      })
      .catch(error => {
        if (requestVersion.current === version) {
          setState(current =>
            current.kind === 'ready'
              ? {
                  ...current,
                  loadingMore: false,
                  loadMoreError: readableError(error),
                }
              : current,
          );
        }
      });
  }, [account, dependencies, state]);

  return (
    <Screen
      eyebrow="Activity"
      title="History"
      description={`Showing network activity for ${account.label || account.address}.`}>
      {renderHistoryState(state, () => loadInitial(true), loadMore)}
    </Screen>
  );
}

function renderHistoryState(
  state: HistoryState,
  onRefresh: () => void,
  onLoadMore: () => void,
): React.ReactNode {
  switch (state.kind) {
    case 'loading':
      return (
        <Card title="Loading activity">
          <View style={styles.inline}>
            <ActivityIndicator />
            <Text style={styles.meta}>Loading recent Stellar operations...</Text>
          </View>
        </Card>
      );
    case 'inactive':
      return (
        <Card
          title="Account not activated"
          description="This account does not exist on the selected Stellar network yet.">
          <Button label="Refresh" variant="secondary" onPress={onRefresh} />
        </Card>
      );
    case 'unsupported-account':
      return (
        <Card
          title="History unavailable"
          description="Classic Horizon operation history is not applied to contract accounts in this version."
        />
      );
    case 'error':
      return (
        <Card title="Unable to load activity" description={state.message}>
          <Button label="Retry" variant="secondary" onPress={onRefresh} />
        </Card>
      );
    case 'ready':
      return (
        <>
          <View style={styles.headerActions}>
            <Text style={styles.meta}>
              {state.entries.length === 0
                ? 'No network operations found.'
                : `${state.entries.length} operation(s) loaded.`}
            </Text>
            <View style={styles.refreshAction}>
              <Button
                label={state.refreshing ? 'Refreshing...' : 'Refresh'}
                variant="ghost"
                onPress={onRefresh}
                disabled={state.refreshing || state.loadingMore}
              />
            </View>
          </View>

          {state.entries.length === 0 ? (
            <Card
              title="No activity yet"
              description="No successful Horizon operations are currently available for this account."
            />
          ) : (
            state.entries.map(entry => <HistoryEntryCard key={entry.id} entry={entry} />)
          )}

          {state.loadMoreError ? (
            <Card title="Could not load older activity" description={state.loadMoreError} />
          ) : null}

          {state.nextCursor !== undefined ? (
            <Button
              label={state.loadingMore ? 'Loading...' : 'Load more'}
              variant="secondary"
              onPress={onLoadMore}
              disabled={state.loadingMore || state.refreshing}
            />
          ) : null}
        </>
      );
  }
}

function HistoryEntryCard({entry}: Readonly<{entry: HistoryEntry}>) {
  const presentation = historyEntryPresentation(entry);
  const occurredAt = new Date(entry.occurredAt).toLocaleString();

  return (
    <Card title={presentation.title} description={presentation.primary}>
      <Text selectable numberOfLines={1} style={styles.value}>
        {presentation.secondary}
      </Text>
      <Text style={styles.meta}>{occurredAt}</Text>
      <Text selectable numberOfLines={1} style={styles.meta}>
        Transaction: {entry.transactionHash}
      </Text>
    </Card>
  );
}

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : 'Unable to load account activity.';
}

const styles = StyleSheet.create({
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  refreshAction: {
    minWidth: 108,
  },
  value: {
    ...typography.caption,
    color: palette.text,
  },
  meta: {
    ...typography.caption,
    color: palette.textMuted,
  },
});
