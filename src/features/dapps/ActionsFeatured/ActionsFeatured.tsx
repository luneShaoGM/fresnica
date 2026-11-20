import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import type { DappCatalogEntry, DappCatalogLoadResult, DappCatalogPort } from '@capabilities/dapp-catalog/catalog';
import { normalizeUntrustedDappUrl } from '@capabilities/dapp-interaction/externalDappUrl';
import { NativeButton } from '@ui/components/NativeButton';
import { useThemedStyles } from '@ui/theme';
import { useLocalization } from '../../../locale';
import { DappCatalogIcon, DappPublicIconToggle, useDappIconState } from '../DappCatalogIcon';
import { createStyles } from './styles';

type Result = DappCatalogLoadResult | Readonly<{ kind: 'loading' }>;
const EMPTY: readonly DappCatalogEntry[] = [];
const ICON_VIEWABILITY = { itemVisiblePercentThreshold: 1 };
function cached(catalog: DappCatalogPort): DappCatalogLoadResult | undefined {
  try {
    const value = catalog.readCached?.();
    return value?.kind === 'ready' ? value : undefined;
  } catch {
    return undefined;
  }
}

export function ActionsFeatured({
  catalog,
  active,
  online,
  inVerticalViewport,
  onLayout,
  onCardsLayout,
  onOpen,
}: Readonly<{
  catalog: DappCatalogPort;
  active: boolean;
  online: boolean;
  inVerticalViewport: boolean;
  onLayout?: (event: LayoutChangeEvent) => void;
  onCardsLayout?: (event: LayoutChangeEvent) => void;
  onOpen: (entry: DappCatalogEntry) => boolean;
}>) {
  const { t } = useLocalization();
  const styles = useThemedStyles(createStyles);
  const initial = useMemo(() => cached(catalog), [catalog]);
  const [state, setState] = useState<{ owner: DappCatalogPort; value: Result; refreshFailed?: boolean }>({
    owner: catalog,
    value: initial ?? { kind: 'loading' },
  });
  const [retry, setRetry] = useState(0);
  const shown = state.owner === catalog ? state.value : (initial ?? { kind: 'loading' as const });
  const entries = shown.kind === 'ready' ? (shown.featured ?? EMPTY) : EMPTY;
  const itemKeys = JSON.stringify(entries.map(entry => entry.id));
  const listSession = useRef({ owner: catalog, itemKeys, key: 0 });
  if (listSession.current.owner !== catalog || listSession.current.itemKeys !== itemKeys) {
    listSession.current = { owner: catalog, itemKeys, key: listSession.current.key + 1 };
  }
  const session = listSession.current;
  const [visibility, setVisibility] = useState<{ session: typeof session; keys: ReadonlySet<string> }>(() => ({
    session,
    keys: new Set(),
  }));
  const iconVisibility = useMemo(
    () => ({ horizontal: visibility, vertical: inVerticalViewport }),
    [visibility, inVerticalViewport],
  );
  const live = useRef<{ owner: DappCatalogPort; active: boolean; entries: readonly DappCatalogEntry[] } | undefined>(
    undefined,
  );
  live.current = { owner: catalog, active, entries };
  useEffect(
    () => () => {
      live.current = undefined;
    },
    [],
  );
  useEffect(() => {
    let current = true;
    const stored = cached(catalog);
    setState(previous => ({
      owner: catalog,
      value:
        stored ??
        (previous.owner === catalog && previous.value.kind === 'ready'
          ? { ...previous.value, stale: true }
          : { kind: 'loading' }),
    }));
    if (!active || !online) return;
    const failed = () => {
      if (!current) return;
      setState(previous => ({
        owner: catalog,
        refreshFailed: true,
        value:
          previous.owner === catalog && previous.value.kind === 'ready'
            ? { ...previous.value, stale: true }
            : { kind: 'unavailable' },
      }));
    };
    Promise.resolve()
      .then(() => (current ? catalog.load() : undefined))
      .then(value => {
        if (!current || !value) return;
        if (value.kind === 'unavailable') failed();
        else setState({ owner: catalog, value, refreshFailed: value.stale === true });
      })
      .catch(failed);
    return () => {
      current = false;
    };
  }, [catalog, active, online, retry]);

  const hideEmpty = shown.kind === 'ready' && entries.length === 0 && !shown.stale;
  const open = (entry: DappCatalogEntry) => {
    if (!live.current?.active || live.current.owner !== catalog || !live.current.entries.includes(entry)) return;
    if (onOpen(entry)) live.current = undefined;
  };
  if (hideEmpty) return null;
  return (
    <View style={styles.section} onLayout={onLayout}>
      <Text accessibilityRole="header" style={styles.heading}>
        {t('actions.suggestions')}
      </Text>
      {entries.length > 0 ? (
        <FlatList
          horizontal
          key={session.key}
          data={entries}
          extraData={iconVisibility}
          onLayout={onCardsLayout}
          viewabilityConfig={ICON_VIEWABILITY}
          onViewableItemsChanged={({ viewableItems }) => {
            if (!live.current?.active || listSession.current !== session) return;
            setVisibility({
              session,
              keys: new Set(viewableItems.filter(token => token.isViewable).map(token => token.key)),
            });
          }}
          keyExtractor={entry => entry.id}
          initialNumToRender={4}
          windowSize={3}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <FeaturedApp
              entry={item}
              catalog={catalog}
              active={active}
              online={online}
              visible={inVerticalViewport && visibility.session === session && visibility.keys.has(item.id)}
              onPress={() => open(item)}
            />
          )}
        />
      ) : (
        <Text style={styles.notice}>
          {t(
            !online
              ? 'dapps.catalog.offline'
              : shown.kind === 'loading'
                ? 'dapps.catalog.loading'
                : shown.kind === 'ready'
                  ? 'actions.suggestionsEmpty'
                  : 'dapps.catalog.error',
          )}
        </Text>
      )}
      {shown.kind === 'ready' && shown.stale ? (
        <Text accessibilityLiveRegion="polite" style={styles.notice}>
          {t(state.owner === catalog && state.refreshFailed ? 'dapps.catalog.stale' : 'dapps.catalog.cached')}
        </Text>
      ) : null}
      {shown.kind === 'unavailable' || (shown.kind === 'ready' && shown.stale) ? (
        <NativeButton
          label={t('dapps.catalog.retry')}
          disabled={!active || !online}
          onPress={() => setRetry(value => value + 1)}
          variant="secondary"
        />
      ) : null}
      {entries.length > 0 ? <DappPublicIconToggle media={catalog.publicMedia} /> : null}
    </View>
  );
}

function FeaturedApp({
  entry,
  catalog,
  active,
  online,
  visible,
  onPress,
}: Readonly<{
  entry: DappCatalogEntry;
  catalog: DappCatalogPort;
  active: boolean;
  online: boolean;
  visible: boolean;
  onPress: () => void;
}>) {
  const styles = useThemedStyles(createStyles);
  const media = catalog.publicMedia;
  const icons = useDappIconState(media);
  useEffect(() => {
    if (!visible || !active || !online || !icons.enabled || !media?.available) return;
    const controller = new AbortController();
    media.loadIcon(entry, controller.signal).catch(() => undefined);
    return () => controller.abort();
  }, [entry, media, active, online, visible, icons.enabled]);
  const target = normalizeUntrustedDappUrl(entry.websiteUrl);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={entry.title + ': ' + target.origin}
      disabled={!active}
      onPress={onPress}
      style={styles.item}
    >
      <DappCatalogIcon entry={entry} media={media} styles={styles} />
      <Text style={styles.title}>{entry.title}</Text>
      <Text style={styles.notice}>{target.hostname}</Text>
    </Pressable>
  );
}
