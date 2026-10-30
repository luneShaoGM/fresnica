import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import type { DappCatalogEntry, DappCatalogLoadResult, DappCatalogPort } from '@capabilities/dapp-catalog/catalog';
import { catalogCategories, filterCatalogEntries } from '@capabilities/dapp-catalog/catalog';
import { normalizeUntrustedDappUrl, type UntrustedDappUrl } from '@capabilities/dapp-interaction/externalDappUrl';
import { BottomSheet, Screen } from '@ui/components';
import { NativeButton } from '@ui/components/NativeButton';
import { NativeField } from '@ui/components/NativeField';
import { NativeScreen } from '@ui/components/NativeScreen';
import { NativeStateView } from '@ui/components/NativeStateView';
import { useThemedStyles } from '@ui/theme';

import { useLocalization } from '../../../../locale';
import { createStyles } from './styles';

type CatalogState =
  | Readonly<{ kind: 'loading' }>
  | Readonly<{ kind: 'offline' }>
  | Readonly<{ kind: 'unavailable' }>
  | Readonly<{ kind: 'error' }>
  | Readonly<{ kind: 'ready'; entries: readonly DappCatalogEntry[]; refreshFailed?: boolean; stale?: boolean }>;

type Section = 'home' | 'recent';

export function DAppsScreen({
  catalog,
  showInterfaceSample = __DEV__,
  openExternalUrl,
  openInApp,
  inAppUnavailable = false,
  active = true,
  online = true,
  focused = active,
}: Readonly<{
  catalog: DappCatalogPort;
  active?: boolean;
  online?: boolean;
  focused?: boolean;
  showInterfaceSample?: boolean;
  openExternalUrl: (url: string) => Promise<void>;
  openInApp?: (url: string) => void;
  inAppUnavailable?: boolean;
}>) {
  const { t } = useLocalization();
  const styles = useThemedStyles(createStyles);
  const [section, setSection] = useState<Section>('home');
  const [category, setCategory] = useState<string>();
  const [searchText, setSearchText] = useState('');
  const [sampleQuery, setSampleQuery] = useState('');
  const [sampleCategory, setSampleCategory] = useState<string>();
  const [retryCount, setRetryCount] = useState(0);
  const [state, setState] = useState<CatalogState>({ kind: online ? 'loading' : 'offline' });
  const [websiteInput, setWebsiteInput] = useState('');
  const [urlSheetOpen, setUrlSheetOpen] = useState(false);
  const [preparedWebsite, setPreparedWebsite] = useState<UntrustedDappUrl>();
  const [recentOrigins, setRecentOrigins] = useState<readonly string[]>([]);
  const [websiteError, setWebsiteError] = useState<'invalid' | 'openFailed'>();
  const [opening, setOpening] = useState(false);
  const openingRef = useRef(false);
  const activeRef = useRef(active);
  activeRef.current = active;
  const websiteEpoch = useRef(0);
  const urlSheetSessionRef = useRef(0);
  const urlSheetActiveRef = useRef(false);
  const handoffEpoch = useRef(0);
  const focusedRef = useRef(focused);
  focusedRef.current = focused;
  const proposalRef = useRef<Readonly<{ value: UntrustedDappUrl; epoch: number }> | undefined>(undefined);
  const mountedRef = useRef(false);
  const previousCatalog = useRef(catalog);
  const interfaceSamples = useMemo<readonly DappCatalogEntry[]>(
    () => [
      {
        id: 'interface-sample-directory',
        title: t('dapps.catalog.sample.directory.title'),
        description: t('dapps.catalog.sample.directory.body'),
        category: t('dapps.catalog.sample.directory.category'),
        websiteUrl: 'https://example.invalid',
      },
      {
        id: 'interface-sample-tools',
        title: t('dapps.catalog.sample.tools.title'),
        description: t('dapps.catalog.sample.tools.body'),
        category: t('dapps.catalog.sample.tools.category'),
        websiteUrl: 'https://example.invalid',
      },
    ],
    [t],
  );

  useEffect(() => {
    const changedCatalog = previousCatalog.current !== catalog;
    previousCatalog.current = catalog;
    if (!active || !online) {
      let cached: DappCatalogLoadResult | undefined;
      if (!online) {
        try {
          cached = catalog.readCached?.();
        } catch {
          // A closed/corrupt public cache is unavailable, never an online request.
        }
      }
      setState(previous => {
        if (!changedCatalog && previous.kind === 'ready') return { ...previous, stale: true };
        if (cached?.kind === 'ready') return { kind: 'ready', entries: cached.entries, stale: true };
        if (!online) return { kind: 'offline' };
        return changedCatalog ? { kind: 'loading' } : previous;
      });
      return;
    }
    let current = true;
    setState(previous =>
      !changedCatalog && previous.kind === 'ready' ? { ...previous, stale: true } : { kind: 'loading' },
    );
    Promise.resolve()
      .then(() => (current ? catalog.load() : undefined))
      .then(result => {
        if (!current || result === undefined) return;
        setState(
          result.kind === 'unavailable'
            ? { kind: 'unavailable' }
            : { kind: 'ready', entries: result.entries, ...(result.stale ? { stale: true, refreshFailed: true } : {}) },
        );
      })
      .catch(() => {
        if (current)
          setState(previous =>
            previous.kind === 'ready' ? { ...previous, refreshFailed: true, stale: true } : { kind: 'error' },
          );
      });
    return () => {
      current = false;
    };
  }, [catalog, retryCount, active, online]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      websiteEpoch.current += 1;
      handoffEpoch.current += 1;
      urlSheetSessionRef.current += 1;
      urlSheetActiveRef.current = false;
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!active) {
      urlSheetSessionRef.current += 1;
      urlSheetActiveRef.current = false;
      setPreparedWebsite(undefined);
      setWebsiteError(undefined);
      setUrlSheetOpen(false);
    }
    return () => {
      websiteEpoch.current += 1;
    };
  }, [active]);

  useEffect(
    () => () => {
      handoffEpoch.current += 1;
    },
    [focused],
  );

  const urlSheetSession = urlSheetSessionRef.current;

  const prepareWebsite = (value: string) => {
    if (!mountedRef.current || !activeRef.current || openingRef.current) return;
    try {
      const verified = normalizeUntrustedDappUrl(value);
      proposalRef.current = { value: verified, epoch: websiteEpoch.current };
      setPreparedWebsite(verified);
      setWebsiteError(undefined);
    } catch {
      setPreparedWebsite(undefined);
      setWebsiteError('invalid');
    }
  };

  const closeUrlSheet = () => {
    if (!urlSheetActiveRef.current || urlSheetSessionRef.current !== urlSheetSession || openingRef.current) return;
    urlSheetSessionRef.current += 1;
    urlSheetActiveRef.current = false;
    websiteEpoch.current += 1;
    handoffEpoch.current += 1;
    setUrlSheetOpen(false);
    setWebsiteInput('');
    setWebsiteError(undefined);
  };

  const submitUrlSheet = () => {
    if (
      !urlSheetOpen ||
      !urlSheetActiveRef.current ||
      urlSheetSessionRef.current !== urlSheetSession ||
      !mountedRef.current ||
      !activeRef.current ||
      !focusedRef.current ||
      !websiteInput.trim() ||
      openingRef.current
    )
      return;
    try {
      normalizeUntrustedDappUrl(websiteInput);
    } catch {
      setWebsiteError('invalid');
      return;
    }
    urlSheetSessionRef.current += 1;
    urlSheetActiveRef.current = false;
    setUrlSheetOpen(false);
    prepareWebsite(websiteInput);
  };

  const changeSection = (next: Section) => {
    // A browser handoff cannot be reversed, but its late completion must
    // not attach a Recent origin to an unrelated screen after navigation.
    websiteEpoch.current += 1;
    handoffEpoch.current += 1;
    urlSheetSessionRef.current += 1;
    urlSheetActiveRef.current = false;
    setPreparedWebsite(undefined);
    setUrlSheetOpen(false);
    setWebsiteInput('');
    setWebsiteError(undefined);
    setSection(next);
  };

  const confirmWebsite = async () => {
    if (
      !mountedRef.current ||
      !activeRef.current ||
      !preparedWebsite ||
      openingRef.current ||
      proposalRef.current?.value !== preparedWebsite ||
      proposalRef.current.epoch !== websiteEpoch.current
    )
      return;
    // This confirmation opens the site in the system browser only.
    // Fresnica never shares wallet identity, permission or signing.
    const proposal = preparedWebsite;
    const epoch = websiteEpoch.current;
    const visitEpoch = handoffEpoch.current;
    openingRef.current = true;
    setOpening(true);
    setWebsiteError(undefined);
    try {
      await openExternalUrl(proposal.url);
      if (!mountedRef.current || !focusedRef.current || handoffEpoch.current !== visitEpoch) return;
      setRecentOrigins(previous =>
        [proposal.origin, ...previous.filter(origin => origin !== proposal.origin)].slice(0, 10),
      );
      if (activeRef.current && websiteEpoch.current === epoch) {
        setPreparedWebsite(undefined);
        setWebsiteInput('');
      }
    } catch {
      if (mountedRef.current && websiteEpoch.current === epoch) {
        setWebsiteError('openFailed');
      }
    } finally {
      openingRef.current = false;
      if (mountedRef.current) setOpening(false);
    }
  };

  const categories = useMemo(() => (state.kind === 'ready' ? catalogCategories(state.entries) : []), [state]);
  const selectedCategory = category !== undefined && categories.includes(category) ? category : undefined;
  const visibleEntries = useMemo(
    () => (state.kind === 'ready' ? filterCatalogEntries(state.entries, selectedCategory, searchText) : []),
    [state, selectedCategory, searchText],
  );

  return (
    <Screen scrollable={false} contentInset="none">
      <NativeScreen padded={false} scroll>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('nav.dapps')}</Text>
            <Pressable
              accessibilityLabel={t('dapps.website.customTitle')}
              accessibilityRole="button"
              disabled={opening}
              hitSlop={12}
              onPress={() => {
                websiteEpoch.current += 1;
                handoffEpoch.current += 1;
                urlSheetSessionRef.current += 1;
                urlSheetActiveRef.current = true;
                setWebsiteInput('');
                setWebsiteError(undefined);
                setPreparedWebsite(undefined);
                setUrlSheetOpen(true);
              }}
              style={styles.headerIcon}
            >
              <Text style={styles.headerGlyph}>🌐</Text>
            </Pressable>
          </View>

          <View style={styles.segment}>
            <SegmentButton
              label={t('dapps.catalog.home')}
              selected={section === 'home'}
              onPress={() => changeSection('home')}
              styles={styles}
            />
            <SegmentButton
              label={t('dapps.catalog.recent')}
              selected={section === 'recent'}
              onPress={() => changeSection('recent')}
              styles={styles}
            />
          </View>

          {section === 'recent' ? (
            <View style={styles.websiteSection}>
              <Text style={styles.websiteDetail}>{t('dapps.website.recentNotice')}</Text>
              {recentOrigins.length === 0 ? (
                <EmptyCatalog message={t('dapps.website.recentEmpty')} styles={styles} />
              ) : (
                recentOrigins.map(origin => (
                  <NativeButton
                    key={origin}
                    label={origin}
                    disabled={opening}
                    onPress={() => prepareWebsite(origin)}
                    variant="quiet"
                  />
                ))
              )}
            </View>
          ) : (
            <>
              {state.kind === 'ready' ? (
                <>
                  {state.stale ? (
                    <>
                      <Text accessibilityLiveRegion="polite" style={styles.previewNotice}>
                        {t(state.refreshFailed ? 'dapps.catalog.stale' : 'dapps.catalog.cached')}
                      </Text>
                      <NativeButton
                        label={t('dapps.catalog.retry')}
                        onPress={() => setRetryCount(value => value + 1)}
                        disabled={!active || !online}
                        variant="secondary"
                      />
                    </>
                  ) : null}
                  <NativeField
                    accessibilityLabel={t('dapps.catalog.search')}
                    autoCapitalize="none"
                    autoCorrect={false}
                    label={t('dapps.catalog.search')}
                    onChangeText={setSearchText}
                    placeholder={t('dapps.catalog.search')}
                    returnKeyType="search"
                    value={searchText}
                  />
                  {categories.length > 0 ? (
                    <ScrollView
                      style={styles.categoryRow}
                      contentContainerStyle={styles.categories}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                    >
                      {[undefined, ...categories].map(item => (
                        <Pressable
                          key={item ?? 'all'}
                          accessibilityRole="button"
                          accessibilityState={{ selected: selectedCategory === item }}
                          onPress={() => setCategory(item)}
                          style={[styles.chip, selectedCategory === item ? styles.chipSelected : undefined]}
                        >
                          <Text
                            style={[styles.chipText, selectedCategory === item ? styles.chipTextSelected : undefined]}
                          >
                            {item ?? t('dapps.catalog.all')}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  ) : null}
                  <Text style={styles.sectionTitle}>{t('dapps.catalog.readOnly')}</Text>
                  {visibleEntries.length > 0 ? (
                    visibleEntries.map(entry => <AppRow key={entry.id} entry={entry} styles={styles} />)
                  ) : (
                    <EmptyCatalog
                      message={
                        searchText.trim() || selectedCategory !== undefined
                          ? t('dapps.catalog.noMatch')
                          : t('dapps.catalog.empty')
                      }
                      styles={styles}
                    />
                  )}
                </>
              ) : state.kind === 'offline' ? (
                <EmptyCatalog message={t('dapps.catalog.offline')} styles={styles} />
              ) : state.kind === 'loading' ? (
                <View style={styles.emptyCatalog}>
                  <ActivityIndicator accessibilityLabel={t('dapps.catalog.loading')} />
                  <Text style={styles.emptyText}>{t('dapps.catalog.loading')}</Text>
                </View>
              ) : state.kind === 'unavailable' ? (
                <>
                  <EmptyCatalog message={t('dapps.catalog.unavailable')} styles={styles} />
                  {showInterfaceSample ? (
                    <InterfaceSample
                      category={sampleCategory}
                      entries={interfaceSamples}
                      onCategory={setSampleCategory}
                      onClear={() => setSampleQuery('')}
                      onQuery={setSampleQuery}
                      query={sampleQuery}
                      styles={styles}
                      t={t}
                    />
                  ) : null}
                </>
              ) : (
                <>
                  <EmptyCatalog message={t('dapps.catalog.error')} styles={styles} />
                  <NativeButton
                    label={t('dapps.catalog.retry')}
                    onPress={() => setRetryCount(value => value + 1)}
                    variant="primary"
                  />
                </>
              )}
            </>
          )}
          <BottomSheet closeLabel={t('dapps.website.cancel')} onClose={closeUrlSheet} visible={urlSheetOpen}>
            <View style={styles.urlSheet}>
              <View style={styles.urlSheetHeader}>
                <Text style={styles.sectionTitle}>{t('nav.dapps')}</Text>
                <NativeButton label={t('dapps.website.cancel')} onPress={closeUrlSheet} variant="quiet" />
              </View>
              <Text style={styles.websiteDetail}>{t('dapps.website.input')}</Text>
              <NativeField
                label={t('dapps.website.input')}
                accessibilityLabel={t('dapps.website.input')}
                autoFocus
                keyboardType="url"
                autoCapitalize="none"
                autoCorrect={false}
                value={websiteInput}
                onChangeText={value => {
                  if (!urlSheetOpen || !urlSheetActiveRef.current || urlSheetSessionRef.current !== urlSheetSession)
                    return;
                  websiteEpoch.current += 1;
                  handoffEpoch.current += 1;
                  setWebsiteInput(value);
                  setPreparedWebsite(undefined);
                  setWebsiteError(undefined);
                }}
                onSubmitEditing={submitUrlSheet}
                placeholder={t('dapps.website.placeholder')}
                returnKeyType="go"
              />
              {websiteError === 'invalid' ? (
                <Text accessibilityLiveRegion="assertive" style={styles.websiteError}>
                  {t('dapps.website.invalid')}
                </Text>
              ) : null}
              <NativeButton
                label={t('dapps.website.preview')}
                disabled={opening || !websiteInput.trim()}
                onPress={submitUrlSheet}
                variant="primary"
              />
            </View>
          </BottomSheet>
          {preparedWebsite ? (
            <View style={styles.websiteConfirmation}>
              <Text style={styles.websiteWarning}>{t('dapps.website.unreviewed')}</Text>
              <Text style={styles.websiteDetail}>{t('dapps.website.trustBoundary')}</Text>
              <Text selectable style={styles.websiteOrigin}>
                {preparedWebsite.origin}
              </Text>
              <Text selectable style={styles.websiteDetail}>
                {preparedWebsite.url}
              </Text>
              <NativeButton
                label={opening ? t('dapps.website.opening') : t('dapps.website.confirm')}
                disabled={opening}
                onPress={() => {
                  confirmWebsite();
                }}
                variant="primary"
              />
              {inAppUnavailable ? (
                <Text style={styles.websiteDetail}>{t('dapps.browser.androidUnavailable')}</Text>
              ) : null}
              {openInApp ? (
                <NativeButton
                  label={t('dapps.website.openInApp')}
                  disabled={opening}
                  onPress={() => {
                    if (
                      !mountedRef.current ||
                      !activeRef.current ||
                      !focusedRef.current ||
                      proposalRef.current?.value !== preparedWebsite ||
                      proposalRef.current.epoch !== websiteEpoch.current
                    )
                      return;
                    websiteEpoch.current += 1;
                    handoffEpoch.current += 1;
                    setPreparedWebsite(undefined);
                    openInApp(preparedWebsite.url);
                  }}
                  variant="secondary"
                />
              ) : null}
              <NativeButton
                label={t('dapps.website.cancel')}
                disabled={opening}
                onPress={() => {
                  websiteEpoch.current += 1;
                  handoffEpoch.current += 1;
                  setPreparedWebsite(undefined);
                  setWebsiteError(undefined);
                }}
                variant="quiet"
              />
            </View>
          ) : null}
          {websiteError === 'openFailed' ? (
            <Text accessibilityLiveRegion="assertive" style={styles.websiteError}>
              {t('dapps.website.failed')}
            </Text>
          ) : null}
        </View>
      </NativeScreen>
    </Screen>
  );
}

type Styles = ReturnType<typeof createStyles>;

function SegmentButton({
  label,
  selected,
  onPress,
  styles,
}: Readonly<{ label: string; selected: boolean; onPress: () => void; styles: Styles }>) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.segmentButton, selected ? styles.segmentButtonSelected : undefined]}
    >
      <Text style={[styles.segmentText, selected ? styles.segmentTextSelected : undefined]}>{label}</Text>
    </Pressable>
  );
}

function AppRow({ entry, styles }: Readonly<{ entry: DappCatalogEntry; styles: Styles }>) {
  return (
    <View style={styles.appRow}>
      <View style={styles.appIcon}>
        <Text style={styles.appInitials}>{entry.title.trim().slice(0, 2).toUpperCase()}</Text>
      </View>
      <View style={styles.appIdentity}>
        <Text style={styles.appTitle}>{entry.title}</Text>
        <Text numberOfLines={2} style={styles.appSubtitle}>
          {entry.description}
        </Text>
      </View>
    </View>
  );
}

function EmptyCatalog({ message, styles }: Readonly<{ message: string; styles: Styles }>) {
  return (
    <View style={styles.emptyCatalog}>
      <NativeStateView title={message} />
    </View>
  );
}

function InterfaceSample({
  entries,
  query,
  category,
  onQuery,
  onCategory,
  onClear,
  styles,
  t,
}: Readonly<{
  entries: readonly DappCatalogEntry[];
  query: string;
  category: string | undefined;
  onQuery: (value: string) => void;
  onCategory: (value: string | undefined) => void;
  onClear: () => void;
  styles: Styles;
  t: (key: string) => string;
}>) {
  const categories = catalogCategories(entries);
  const selectedCategory = category !== undefined && categories.includes(category) ? category : undefined;
  const visibleEntries = filterCatalogEntries(entries, selectedCategory, query);

  return (
    <>
      <Text style={styles.previewNotice}>{t('dapps.catalog.previewNotice')}</Text>
      <NativeField
        accessibilityLabel={t('dapps.catalog.search')}
        autoCapitalize="none"
        autoCorrect={false}
        label={t('dapps.catalog.search')}
        onChangeText={onQuery}
        placeholder={t('dapps.catalog.search')}
        returnKeyType="search"
        value={query}
      />
      <ScrollView
        style={styles.categoryRow}
        contentContainerStyle={styles.categories}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {[undefined, ...categories].map(item => (
          <Pressable
            key={item ?? 'all'}
            accessibilityRole="button"
            accessibilityState={{ selected: selectedCategory === item }}
            onPress={() => onCategory(item)}
            style={[styles.chip, selectedCategory === item ? styles.chipSelected : undefined]}
          >
            <Text style={[styles.chipText, selectedCategory === item ? styles.chipTextSelected : undefined]}>
              {item ?? t('dapps.catalog.all')}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <Text style={styles.sectionTitle}>{t('dapps.catalog.readOnly')}</Text>
      {visibleEntries.length > 0 ? (
        visibleEntries.map(entry => <AppRow key={entry.id} entry={entry} styles={styles} />)
      ) : (
        <EmptyCatalog message={t('dapps.catalog.noMatch')} styles={styles} />
      )}
      <NativeButton label={t('dapps.catalog.previewClear')} onPress={onClear} variant="primary" />
    </>
  );
}
