import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import type { DappRecentHistory } from '@capabilities/dapp-interaction/dappRecentHistory';
import { useDappRecent } from '../../useDappRecent';
import type { DappCatalogEntry, DappCatalogLoadResult, DappCatalogPort } from '@capabilities/dapp-catalog/catalog';
import { catalogCategories, filterCatalogEntries } from '@capabilities/dapp-catalog/catalog';
import { normalizeUntrustedDappUrl, type UntrustedDappUrl } from '@capabilities/dapp-interaction/externalDappUrl';
import { BottomSheet, Screen } from '@ui/components';
import { SelectableChip } from '@ui/components/SelectableChip';
import { NativeButton } from '@ui/components/NativeButton';
import { NativeField } from '@ui/components/NativeField';
import { NativeStateView } from '@ui/components/NativeStateView';
import { useThemedStyles } from '@ui/theme';

import { useLocalization } from '../../../../locale';
import { createStyles } from './styles';
import { DappCatalogIcon, DappPublicIconToggle } from '../../DappCatalogIcon';
import { DappDetailSheet } from '../../DappDetailSheet';

type CatalogState =
  | Readonly<{ kind: 'loading' }>
  | Readonly<{ kind: 'offline' }>
  | Readonly<{ kind: 'unavailable' }>
  | Readonly<{ kind: 'error' }>
  | Readonly<{
      kind: 'ready';
      entries: readonly DappCatalogEntry[];
      featured?: readonly DappCatalogEntry[];
      refreshFailed?: boolean;
      stale?: boolean;
    }>;

type Section = 'home' | 'recent';

export function DAppsScreen({
  scannedUrl,
  clearScannedUrl,
  catalog,
  recentHistory,
  showInterfaceSample = __DEV__,
  openExternalUrl,
  openInApp,
  openCatalogInApp,
  inAppUnavailable = false,
  active = true,
  online = true,
  focused = active,
}: Readonly<{
  scannedUrl?: string;
  clearScannedUrl?: () => void;
  catalog: DappCatalogPort;
  recentHistory?: DappRecentHistory;
  active?: boolean;
  online?: boolean;
  focused?: boolean;
  showInterfaceSample?: boolean;
  openExternalUrl: (url: string) => Promise<void>;
  openInApp?: (url: string) => void;
  openCatalogInApp?: (entry: DappCatalogEntry, fresh: boolean) => void;
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
  const [refreshingCatalog, setRefreshingCatalog] = useState(false);
  const catalogLoadPending = useRef(false);
  const [state, setState] = useState<CatalogState>({ kind: online ? 'loading' : 'offline' });
  const [websiteInput, setWebsiteInput] = useState('');
  const [urlSheetOpen, setUrlSheetOpen] = useState(false);
  const [preparedWebsite, setPreparedWebsite] = useState<UntrustedDappUrl>();
  const recent = useDappRecent(recentHistory);
  const recentOrigins = recent.origins;
  const [websiteError, setWebsiteError] = useState<'invalid' | 'openFailed'>();
  const [opening, setOpening] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<DappCatalogEntry>();
  // Retire late Open callbacks when the detail sheet closes or another
  // catalog/route/focus session replaces it.
  const detailEpoch = useRef(0);
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
    if (changedCatalog) {
      detailEpoch.current += 1;
      setSelectedDetail(undefined);
    }
    if (!active || !online) {
      catalogLoadPending.current = false;
      setRefreshingCatalog(false);
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
        if (cached?.kind === 'ready') return { ...cached, stale: true };
        if (!online) return { kind: 'offline' };
        return changedCatalog ? { kind: 'loading' } : previous;
      });
      return;
    }
    let current = true;
    catalogLoadPending.current = true;
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
            : { ...result, ...(result.stale ? { refreshFailed: true } : {}) },
        );
      })
      .catch(() => {
        if (current)
          setState(previous =>
            previous.kind === 'ready' ? { ...previous, refreshFailed: true, stale: true } : { kind: 'error' },
          );
      })
      .finally(() => {
        if (current) {
          catalogLoadPending.current = false;
          setRefreshingCatalog(false);
        }
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

  useEffect(() => {
    if (!active || !focused) {
      detailEpoch.current += 1;
      setSelectedDetail(undefined);
    }
  }, [active, focused]);

  useEffect(() => {
    if (!scannedUrl || !active || !focused || !mountedRef.current || openingRef.current) return;
    // A QR is never a trusted catalog item. Reuse the custom URL confirmation.
    prepareWebsite(scannedUrl);
    clearScannedUrl?.();
  }, [scannedUrl, active, focused, clearScannedUrl]);

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
    detailEpoch.current += 1;
    setSelectedDetail(undefined);
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
      recentHistory?.record(proposal.origin);
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

  const openCatalogEntry = (entry: DappCatalogEntry, detailAligned: boolean) => {
    if (
      !mountedRef.current ||
      !activeRef.current ||
      !focusedRef.current ||
      openingRef.current ||
      state.kind !== 'ready' ||
      !state.entries.includes(entry)
    )
      return;
    if (openCatalogInApp) {
      openCatalogInApp(entry, detailAligned && !state.stale && online);
    } else {
      // Unsupported in-app platforms retain the deliberate untrusted URL
      // review before handing public site URLs to the system browser.
      prepareWebsite(entry.websiteUrl);
    }
  };

  const detailSession = detailEpoch.current;
  let implicitReadOnly = false;
  try {
    implicitReadOnly =
      selectedDetail !== undefined &&
      openCatalogInApp !== undefined &&
      active &&
      focused &&
      online &&
      state.kind === 'ready' &&
      !state.stale &&
      state.entries.includes(selectedDetail) &&
      catalog.isTrustedLiveEntry?.(selectedDetail) === true;
  } catch {
    // A faulty/closed provider cannot assert read-only automatic connection.
  }
  const categories = useMemo(() => (state.kind === 'ready' ? catalogCategories(state.entries) : []), [state]);
  const selectedCategory = category !== undefined && categories.includes(category) ? category : undefined;
  const visibleEntries = useMemo(
    () => (state.kind === 'ready' ? filterCatalogEntries(state.entries, selectedCategory, searchText) : []),
    [state, selectedCategory, searchText],
  );

  const featuredEntries = useMemo(() => {
    if (state.kind !== 'ready' || !state.featured) return [];
    const available = new Map(visibleEntries.map(entry => [entry.id, entry]));
    const featured: DappCatalogEntry[] = [];
    for (const item of state.featured) {
      const entry = available.get(item.id);
      if (entry?.websiteUrl === item.websiteUrl) {
        available.delete(item.id);
        featured.push(entry);
      }
    }
    return featured;
  }, [state, visibleEntries]);
  const recentTitles = useMemo(() => {
    const result = new Map<string, string>();
    const ambiguous = new Set<string>();
    if (state.kind === 'ready') {
      for (const entry of state.entries) {
        try {
          const { origin } = normalizeUntrustedDappUrl(entry.websiteUrl);
          if (result.has(origin)) ambiguous.add(origin);
          result.set(origin, entry.title);
        } catch {
          // An invalid public listing cannot label a visited website.
        }
      }
      for (const origin of ambiguous) result.delete(origin);
    }
    return result;
  }, [state]);
  const openDetails = (entry: DappCatalogEntry) => {
    detailEpoch.current += 1;
    setSelectedDetail(entry);
  };

  return (
    <Screen scrollable={false} contentInset="none" safeAreaEdges={['top', 'right', 'left']}>
      <ScrollView
        style={styles.safeArea}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          section === 'home' && active && focused && online ? (
            <RefreshControl
              refreshing={refreshingCatalog}
              onRefresh={() => {
                if (catalogLoadPending.current) return;
                catalogLoadPending.current = true;
                setRefreshingCatalog(true);
                setRetryCount(value => value + 1);
              }}
            />
          ) : undefined
        }
      >
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

          {recent.unavailable && recentHistory && section !== 'recent' ? (
            <Text accessibilityLiveRegion="polite" style={styles.websiteDetail}>
              {t('dapps.website.recentUnavailable')}
            </Text>
          ) : null}
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
              {recent.unavailable ? (
                <>
                  <Text accessibilityLiveRegion="polite" style={styles.websiteDetail}>
                    {t('dapps.website.recentUnavailable')}
                  </Text>
                  <NativeButton label={t('dapps.catalog.retry')} onPress={recentHistory?.retry} variant="secondary" />
                </>
              ) : null}
              {recentOrigins.length === 0 ? (
                <EmptyCatalog message={t('dapps.website.recentEmpty')} styles={styles} />
              ) : (
                recentOrigins.map(origin => (
                  <NativeButton
                    key={origin}
                    label={recentTitles.has(origin) ? `${recentTitles.get(origin)} · ${origin}` : origin}
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
                        <SelectableChip
                          key={item ?? 'all'}
                          label={item ?? t('dapps.catalog.all')}
                          selected={selectedCategory === item}
                          size="compact"
                          onPress={() => setCategory(item)}
                        />
                      ))}
                    </ScrollView>
                  ) : null}
                  <DappPublicIconToggle media={catalog.publicMedia} />
                  {featuredEntries.length > 0 ? (
                    <>
                      <Text accessibilityRole="header" style={styles.appTitle}>
                        {t('dapps.catalog.featured')}
                      </Text>
                      {featuredEntries.map(entry => (
                        <AppRow
                          key={entry.id}
                          entry={entry}
                          styles={styles}
                          media={catalog.publicMedia}
                          onSelect={() => openDetails(entry)}
                          detailsLabel={t('dapps.details.open')}
                        />
                      ))}
                      <Text accessibilityRole="header" style={styles.appTitle}>
                        {t('dapps.catalog.allApps')}
                      </Text>
                    </>
                  ) : null}
                  {visibleEntries.length > 0 ? (
                    visibleEntries.map(entry => (
                      <AppRow
                        key={entry.id}
                        entry={entry}
                        styles={styles}
                        media={catalog.publicMedia}
                        onSelect={() => openDetails(entry)}
                        detailsLabel={t('dapps.details.open')}
                      />
                    ))
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
          <DappDetailSheet
            entry={selectedDetail}
            media={catalog.publicMedia}
            styles={styles}
            active={active && focused}
            online={online}
            onClose={() => {
              detailEpoch.current += 1;
              setSelectedDetail(undefined);
            }}
            inAppAvailable={openCatalogInApp !== undefined}
            implicitReadOnly={implicitReadOnly}
            onOpen={
              selectedDetail
                ? (detailAligned: boolean) => {
                    if (detailEpoch.current !== detailSession) return;
                    detailEpoch.current += 1;
                    const entry = selectedDetail;
                    setSelectedDetail(undefined);
                    openCatalogEntry(entry, detailAligned);
                  }
                : undefined
            }
          />
          <BottomSheet
            avoidAndroidKeyboard
            closeLabel={t('dapps.website.cancel')}
            onClose={closeUrlSheet}
            visible={urlSheetOpen}
          >
            <ScrollView
              style={styles.sheetScroll}
              contentContainerStyle={styles.urlSheet}
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets
            >
              <View style={styles.urlSheetHeader}>
                <Text style={[styles.sectionTitle, styles.sheetHeaderTitle]}>{t('nav.dapps')}</Text>
                <NativeButton label={t('dapps.website.cancel')} onPress={closeUrlSheet} variant="quiet" />
              </View>
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
            </ScrollView>
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
      </ScrollView>
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

function AppRow({
  entry,
  styles,
  media,
  onSelect,
  detailsLabel,
}: Readonly<{
  entry: DappCatalogEntry;
  styles: Styles;
  media?: DappCatalogPort['publicMedia'];
  onSelect?: () => void;
  detailsLabel?: string;
}>) {
  const content = (
    <>
      <DappCatalogIcon entry={entry} media={media} styles={styles} />
      <View style={styles.appIdentity}>
        <Text style={styles.appTitle}>{entry.title}</Text>
        <Text numberOfLines={2} style={styles.appSubtitle}>
          {entry.description}
        </Text>
      </View>
    </>
  );
  return onSelect ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${detailsLabel ?? 'Details'}: ${entry.title}`}
      onPress={onSelect}
      style={styles.appRow}
    >
      {content}
    </Pressable>
  ) : (
    <View style={styles.appRow}>{content}</View>
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
          <SelectableChip
            key={item ?? 'all'}
            label={item ?? t('dapps.catalog.all')}
            selected={selectedCategory === item}
            size="compact"
            onPress={() => onCategory(item)}
          />
        ))}
      </ScrollView>
      {visibleEntries.length > 0 ? (
        visibleEntries.map(entry => <AppRow key={entry.id} entry={entry} styles={styles} />)
      ) : (
        <EmptyCatalog message={t('dapps.catalog.noMatch')} styles={styles} />
      )}
      <NativeButton label={t('dapps.catalog.previewClear')} onPress={onClear} variant="primary" />
    </>
  );
}
