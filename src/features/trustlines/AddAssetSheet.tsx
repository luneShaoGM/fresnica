import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { BottomSheet } from '@ui/components';
import { useAppTheme, useThemedStyles } from '@ui/theme';

import type { AccountRecord } from '../../capabilities/account/types';
import type { BalanceProductDependencies } from '@capabilities/balance/BalanceCacheHydration';
import { useBalanceDisplay } from '../home/useBalanceDisplay';
import { BalanceFreshnessNotice } from '../home/components/BalanceFreshnessNotice';
import { normalizeUntrustedDappUrl } from '../../capabilities/dapp-interaction/externalDappUrl';
import {
  curatedAssetSourcesForNetwork,
  CURATED_ASSET_SOURCES,
  isCuratedAssetCode,
  isCuratedIssuer,
  matchesCuratedAssetQuery,
  normalizeCuratedAssets,
  parseManualAssetDocument,
  type AssetCatalogPort,
  type CuratedAsset,
  type CuratedAssetSourceId,
  type CuratedSourceLoad,
} from '../../capabilities/trustline/curatedAssetCatalog';
import { useLocalization } from '../../locale';
import { createAddAssetSheetStyles } from './addAssetStyles';

export type AddAssetSelection = Readonly<{
  code: string;
  issuer: string;
}>;

type Props = Readonly<{
  visible: boolean;
  account: AccountRecord;
  balanceDependencies: BalanceProductDependencies;
  catalog: AssetCatalogPort;
  active: boolean;
  invalidationRevision: number;
  signing?: boolean;
  onClose: () => void;
  onAddAndSign: (asset: AddAssetSelection) => void;
}>;

type ListedAsset = CuratedAsset & Readonly<{ added: boolean }>;

export function AddAssetSheet({
  visible,
  account,
  balanceDependencies,
  catalog,
  active,
  invalidationRevision,
  signing = false,
  onClose,
  onAddAndSign,
}: Props): React.JSX.Element {
  const { t } = useLocalization();
  const theme = useAppTheme();
  const styles = useThemedStyles(createAddAssetSheetStyles);
  const networkSources = curatedAssetSourcesForNetwork(account.networkId);
  const [manual, setManual] = useState(networkSources.length === 0);
  const { state: balanceState, refresh } = useBalanceDisplay(
    account,
    balanceDependencies,
    visible && active,
    invalidationRevision,
  );
  const held = new Set(
    balanceState.kind === 'ready' && balanceState.snapshot.status === 'active'
      ? balanceState.snapshot.balances
          .filter(line => line.asset.kind === 'credit')
          .map(line => `${line.asset.code}:${line.asset.kind === 'credit' ? line.asset.issuer : ''}`)
      : [],
  );
  const balanceReady =
    balanceState.kind === 'ready' &&
    balanceState.snapshot.status === 'active' &&
    !balanceState.stale &&
    !balanceState.refreshing;
  const urlRequest = useRef<AbortController | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [usingCache, setUsingCache] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [assets, setAssets] = useState<readonly ListedAsset[]>([]);
  const [sources, setSources] = useState<readonly CuratedAssetSourceId[]>(
    CURATED_ASSET_SOURCES.map(source => source.id),
  );
  const [query, setQuery] = useState('');
  const [selectedKey, setSelectedKey] = useState<string>();
  const [reloadKey, setReloadKey] = useState(0);
  const [manualCode, setManualCode] = useState('');
  const [manualIssuer, setManualIssuer] = useState('');
  const [manualUrl, setManualUrl] = useState('');
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlError, setUrlError] = useState<string>();
  const [urlAssets, setUrlAssets] = useState<readonly ListedAsset[]>([]);

  useEffect(() => {
    if (!visible || !active || networkSources.length === 0) return undefined;
    const controller = new AbortController();
    let current = true;
    const selectedSources = networkSources.filter(source => sources.includes(source.id));
    const saved = selectedSources.flatMap(source => {
      try {
        const snapshot = catalog.readCachedSource?.(account.networkId, source.id);
        return snapshot ? [snapshot] : [];
      } catch {
        return [];
      }
    });
    const savedAssets = mergeSourceAssets(saved);
    setAssets(savedAssets);
    setUsingCache(saved.length > 0);
    setRefreshFailed(false);
    setSelectedKey(savedAssets.length > 0 ? assetKey(savedAssets[0]) : undefined);
    setLoading(true);
    setFailed(false);
    void loadListedAssets(catalog, account.networkId, selectedSources, controller.signal, reloadKey > 0)
      .then(result => {
        if (!current || controller.signal.aborted) return;
        setAssets(result.assets);
        setUsingCache(result.fromCache);
        setRefreshFailed(result.refreshFailed);
        setFailed(result.refreshFailed && result.assets.length === 0);
        const firstAvailable = result.assets.find(asset => !asset.added);
        setSelectedKey(firstAvailable ? assetKey(firstAvailable) : undefined);
        setLoading(false);
      })
      .catch(() => {
        if (!current || controller.signal.aborted) return;
        if (savedAssets.length === 0) setFailed(true);
        else setRefreshFailed(true);
        setLoading(false);
      });
    return () => {
      current = false;
      controller.abort();
    };
  }, [account, catalog, reloadKey, sources, visible, active, networkSources]);

  useEffect(() => {
    return () => {
      urlRequest.current?.abort();
    };
  }, [active, visible, account]);

  const listed = assets.map(asset => ({ ...asset, added: held.has(assetKey(asset)) }));
  const visibleAssets = listed.filter(asset => matchesCuratedAssetQuery(asset, query));
  const selected = visibleAssets.find(asset => assetKey(asset) === selectedKey && !asset.added);
  const manualReady = isCuratedAssetCode(manualCode.trim()) && isCuratedIssuer(manualIssuer.trim());
  const canSubmit =
    visible &&
    active &&
    balanceReady &&
    !signing &&
    (manual
      ? manualReady && !held.has(`${manualCode.trim()}:${manualIssuer.trim()}`)
      : !loading && !failed && selected !== undefined);

  const submit = () => {
    if (!canSubmit) return;
    if (manual) {
      onAddAndSign({ code: manualCode.trim(), issuer: manualIssuer.trim() });
      return;
    }
    if (selected) onAddAndSign({ code: selected.code, issuer: selected.issuer });
  };

  return (
    <BottomSheet closeLabel={t('trustlines.add.cancel')} onClose={onClose} visible={visible}>
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text numberOfLines={1} style={styles.title}>
            {t('trustlines.add.title')}
          </Text>
          <View style={styles.headerActions}>
            <Pressable accessibilityRole="button" onPress={() => setManual(current => !current)} style={styles.chip}>
              <Text style={styles.chipText}>{manual ? t('trustlines.add.list') : t('trustlines.add.manual')}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.chip}>
              <Text style={styles.chipText}>{t('trustlines.add.cancel')}</Text>
            </Pressable>
          </View>
        </View>
        <Text style={styles.description}>
          {manual ? t('trustlines.add.manualDescription') : t('trustlines.add.listDescription')}
        </Text>
        <BalanceFreshnessNotice state={balanceState} onRefresh={refresh} />
        {!balanceReady ? (
          <Pressable accessibilityRole="button" onPress={() => refresh()}>
            <Text style={styles.statusText}>{t('trustlines.add.retry')}</Text>
          </Pressable>
        ) : null}
        {manual ? (
          <ScrollView
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            style={styles.list}
          >
            <Text style={styles.fieldLabel}>{t('trustlines.add.domain')}</Text>
            <View style={styles.urlRow}>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel={t('trustlines.add.domain')}
                keyboardType="url"
                onChangeText={value => {
                  urlRequest.current?.abort();
                  setUrlLoading(false);
                  setUrlAssets([]);
                  setManualUrl(value);
                  setUrlError(undefined);
                }}
                placeholder="https://example.com"
                placeholderTextColor={theme.colors.textTertiary}
                style={[styles.search, styles.urlInput]}
                value={manualUrl}
              />
              <Pressable
                accessibilityRole="button"
                disabled={!manualUrl.trim() || urlLoading}
                onPress={() => {
                  if (!visible || !active) return;
                  urlRequest.current?.abort();
                  const controller = new AbortController();
                  urlRequest.current = controller;
                  setUrlAssets([]);
                  setUrlLoading(true);
                  setUrlError(undefined);
                  void loadManualUrl(manualUrl, catalog, controller.signal)
                    .then(found => {
                      if (controller.signal.aborted) return;
                      setUrlAssets(found);
                      const first = found.find(asset => !asset.added);
                      if (first) {
                        setManualCode(first.code);
                        setManualIssuer(first.issuer);
                      }
                    })
                    .catch(() => {
                      if (!controller.signal.aborted) setUrlError(t('trustlines.add.manualUrlError'));
                    })
                    .finally(() => {
                      if (!controller.signal.aborted) setUrlLoading(false);
                    });
                }}
                style={[styles.chip, !manualUrl.trim() || urlLoading ? styles.disabled : undefined]}
              >
                <Text style={styles.chipText}>
                  {urlLoading ? t('trustlines.add.loading') : t('trustlines.add.load')}
                </Text>
              </Pressable>
            </View>
            {urlError ? <Text style={styles.errorText}>{urlError}</Text> : null}
            {urlAssets.map(item => {
              const asset = { ...item, added: held.has(assetKey(item)) };
              return (
                <AssetRow
                  addedLabel={t('trustlines.add.added')}
                  asset={asset}
                  key={`${asset.code}:${asset.issuer}`}
                  onPress={() => {
                    setManualCode(asset.code);
                    setManualIssuer(asset.issuer);
                    setSelectedKey(assetKey(asset));
                  }}
                  selected={manualCode === asset.code && manualIssuer === asset.issuer}
                  styles={styles}
                />
              );
            })}
            <Text style={styles.fieldLabel}>{t('trustlines.add.assetCode')}</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel={t('trustlines.add.assetCode')}
              editable={!urlLoading}
              onChangeText={setManualCode}
              placeholder={t('trustlines.add.assetCodePlaceholder')}
              placeholderTextColor={theme.colors.textTertiary}
              style={styles.search}
              value={manualCode}
            />
            <Text style={styles.fieldLabel}>{t('trustlines.add.issuer')}</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel={t('trustlines.add.issuer')}
              editable={!urlLoading}
              onChangeText={setManualIssuer}
              placeholder={t('trustlines.add.issuerPlaceholder')}
              placeholderTextColor={theme.colors.textTertiary}
              style={styles.search}
              value={manualIssuer}
            />
          </ScrollView>
        ) : (
          <>
            {networkSources.length > 0 ? (
              <View style={styles.filters}>
                {networkSources.map(source => {
                  const selectedSource = sources.includes(source.id);
                  return (
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selectedSource }}
                      key={source.id}
                      onPress={() =>
                        setSources(current =>
                          current.includes(source.id)
                            ? current.filter(id => id !== source.id)
                            : [...current, source.id],
                        )
                      }
                      style={[styles.filter, selectedSource ? styles.filterSelected : undefined]}
                    >
                      <Text style={[styles.filterText, selectedSource ? styles.filterTextSelected : undefined]}>
                        {selectedSource ? '✓ ' : ''}
                        {source.shortName}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
            {networkSources.length > 0 ? (
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={setQuery}
                accessibilityLabel={t('trustlines.add.search')}
                placeholder={t('trustlines.add.search')}
                placeholderTextColor={theme.colors.textTertiary}
                style={styles.search}
                value={query}
              />
            ) : null}
            {(usingCache || refreshFailed) && assets.length > 0 ? (
              <View style={styles.status}>
                <Text style={styles.statusText}>
                  {refreshFailed
                    ? t(usingCache ? 'trustlines.add.cacheRefreshFailed' : 'trustlines.add.partialSourcesFailed')
                    : loading
                      ? t('trustlines.add.cacheRefreshing')
                      : t('trustlines.add.cachedList')}
                </Text>
                {refreshFailed ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setReloadKey(current => current + 1)}
                    style={styles.chip}
                  >
                    <Text style={styles.chipText}>{t('trustlines.add.retry')}</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            {networkSources.length === 0 ? (
              <View style={styles.status}>
                <Text style={styles.statusText}>{t('trustlines.add.networkListUnavailable')}</Text>
                <Pressable accessibilityRole="button" onPress={() => setManual(true)} style={styles.chip}>
                  <Text style={styles.chipText}>{t('trustlines.add.manual')}</Text>
                </Pressable>
              </View>
            ) : sources.length === 0 ? (
              <View style={styles.status}>
                <Text style={styles.statusText}>{t('trustlines.add.emptySources')}</Text>
              </View>
            ) : loading && assets.length === 0 ? (
              <View style={styles.status}>
                <ActivityIndicator color={theme.colors.actionPrimary} />
                <Text style={styles.statusText}>{t('trustlines.add.loading')}</Text>
              </View>
            ) : failed && assets.length === 0 ? (
              <View style={styles.status}>
                <Text style={styles.statusText}>{t('trustlines.add.loadError')}</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setReloadKey(current => current + 1)}
                  style={styles.chip}
                >
                  <Text style={styles.chipText}>{t('trustlines.add.retry')}</Text>
                </Pressable>
              </View>
            ) : (
              <ScrollView
                contentContainerStyle={styles.listContent}
                keyboardShouldPersistTaps="handled"
                style={styles.list}
              >
                {visibleAssets.length === 0 ? (
                  <Text style={styles.statusText}>
                    {query ? t('trustlines.add.noMatch') : t('trustlines.add.empty')}
                  </Text>
                ) : (
                  visibleAssets.map(asset => (
                    <AssetRow
                      addedLabel={t('trustlines.add.added')}
                      asset={asset}
                      key={assetKey(asset)}
                      onPress={() => setSelectedKey(assetKey(asset))}
                      selected={assetKey(asset) === selectedKey}
                      styles={styles}
                    />
                  ))
                )}
              </ScrollView>
            )}
          </>
        )}
        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSubmit }}
            disabled={!canSubmit}
            onPress={submit}
            style={({ pressed }) => [
              styles.primary,
              !canSubmit ? styles.disabled : undefined,
              pressed && canSubmit ? styles.pressed : undefined,
            ]}
          >
            <Text style={styles.primaryText}>
              {signing ? t('trustlines.add.loading') : t('trustlines.add.addAndSign')}
            </Text>
          </Pressable>
        </View>
      </View>
    </BottomSheet>
  );
}

function AssetRow({
  asset,
  selected,
  addedLabel,
  onPress,
  styles,
}: Readonly<{
  asset: ListedAsset;
  selected: boolean;
  addedLabel: string;
  onPress: () => void;
  styles: ReturnType<typeof createAddAssetSheetStyles>;
}>): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: asset.added, selected }}
      disabled={asset.added}
      onPress={onPress}
      style={[styles.row, selected ? styles.rowSelected : undefined, asset.added ? styles.rowAdded : undefined]}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{asset.code.slice(0, 1)}</Text>
      </View>
      <View style={styles.meta}>
        <Text numberOfLines={1} style={[styles.code, selected ? styles.codeSelected : undefined]}>
          {asset.code}
        </Text>
        <Text numberOfLines={1} style={styles.domain}>
          {asset.domain || asset.name || asset.issuer}
        </Text>
      </View>
      {asset.added ? <Text style={styles.addedMark}>{addedLabel}</Text> : null}
    </Pressable>
  );
}

function mergeSourceAssets(results: readonly Pick<CuratedSourceLoad, 'assets'>[]): readonly ListedAsset[] {
  const merged = new Map<string, CuratedAsset>();
  for (const result of results) {
    for (const asset of result.assets) merged.set(assetKey(asset), asset);
  }
  return [...merged.values()].map(asset => ({ ...asset, added: false }));
}

async function loadListedAssets(
  catalog: AssetCatalogPort,
  networkId: string,
  selected: readonly (typeof CURATED_ASSET_SOURCES)[number][],
  signal: AbortSignal,
  forceRefresh: boolean,
): Promise<Readonly<Omit<CuratedSourceLoad, 'assets'> & { assets: readonly ListedAsset[] }>> {
  if (selected.length === 0) return { assets: [], fromCache: false, stale: false, refreshFailed: false };
  const results = await Promise.allSettled(
    selected.map(async source => {
      if (catalog.loadSource) return catalog.loadSource(networkId, source.id, signal, forceRefresh);
      return {
        assets: normalizeCuratedAssets(JSON.parse(await catalog.read(source.url, signal)) as unknown),
        fromCache: false,
        stale: false,
        refreshFailed: false,
      };
    }),
  );
  if (signal.aborted) throw new Error('asset-catalog-cancelled');
  const ready = results.flatMap(result => (result.status === 'fulfilled' ? [result.value] : []));
  if (ready.length === 0) throw new Error('curated-source-unavailable');
  return {
    assets: mergeSourceAssets(ready),
    fromCache: ready.some(result => result.fromCache),
    stale: ready.some(result => result.stale),
    refreshFailed: ready.some(result => result.refreshFailed) || ready.length !== selected.length,
  };
}

async function loadManualUrl(
  input: string,
  catalog: AssetCatalogPort,
  signal: AbortSignal,
): Promise<readonly ListedAsset[]> {
  const target = normalizeUntrustedDappUrl(input);
  let parsed: readonly CuratedAsset[] = [];
  try {
    parsed = parseManualAssetDocument(await catalog.read(target.url, signal));
  } catch (error) {
    if (signal.aborted) throw error;
  }
  if (signal.aborted) throw new Error('asset-catalog-cancelled');
  const found =
    parsed.length > 0
      ? parsed
      : parseManualAssetDocument(await catalog.read(`${target.origin}/.well-known/stellar.toml`, signal));
  return found.map(asset => ({ ...asset, added: false }));
}

function assetKey(asset: Readonly<{ code: string; issuer: string }>): string {
  return `${asset.code}:${asset.issuer}`;
}
