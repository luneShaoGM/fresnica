import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { BottomSheet } from '@ui/components';
import { useAppTheme, useThemedStyles } from '@ui/theme';

import type { AccountRecord } from '../../capabilities/account/types';
import { loadBalanceSnapshot, type BalanceDependencies } from '../../capabilities/balance/loadBalanceSnapshot';
import {
  CURATED_ASSET_SOURCES,
  isCuratedAssetCode,
  isCuratedIssuer,
  matchesCuratedAssetQuery,
  normalizeCuratedAssets,
  parseManualAssetDocument,
  type CuratedAsset,
  type CuratedAssetSourceId,
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
  balanceDependencies: BalanceDependencies;
  signing?: boolean;
  onClose: () => void;
  onAddAndSign: (asset: AddAssetSelection) => void;
}>;

type ListedAsset = CuratedAsset & Readonly<{ added: boolean }>;

export function AddAssetSheet({
  visible,
  account,
  balanceDependencies,
  signing = false,
  onClose,
  onAddAndSign,
}: Props): React.JSX.Element {
  const { t } = useLocalization();
  const theme = useAppTheme();
  const styles = useThemedStyles(createAddAssetSheetStyles);
  const [manual, setManual] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
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
    if (!visible) return undefined;
    let active = true;
    setLoading(true);
    setFailed(false);
    void loadListedAssets(balanceDependencies, account, sources)
      .then(next => {
        if (!active) return;
        setAssets(next);
        const firstAvailable = next.find(asset => !asset.added);
        setSelectedKey(firstAvailable ? assetKey(firstAvailable) : undefined);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setFailed(true);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [account, balanceDependencies, reloadKey, sources, visible]);

  const visibleAssets = useMemo(() => assets.filter(asset => matchesCuratedAssetQuery(asset, query)), [assets, query]);
  const selected = assets.find(asset => assetKey(asset) === selectedKey && !asset.added);
  const manualReady = isCuratedAssetCode(manualCode.trim().toUpperCase()) && isCuratedIssuer(manualIssuer.trim());
  const canSubmit = !signing && (manual ? manualReady : selected !== undefined);

  const submit = () => {
    if (!canSubmit) return;
    if (manual) {
      onAddAndSign({ code: manualCode.trim().toUpperCase(), issuer: manualIssuer.trim() });
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
                keyboardType="url"
                onChangeText={value => {
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
                  setUrlLoading(true);
                  setUrlError(undefined);
                  void loadManualUrl(manualUrl, assets)
                    .then(found => {
                      setUrlAssets(found);
                      const first = found.find(asset => !asset.added);
                      if (first) {
                        setManualCode(first.code);
                        setManualIssuer(first.issuer);
                      }
                    })
                    .catch(() => setUrlError(t('trustlines.add.manualUrlError')))
                    .finally(() => setUrlLoading(false));
                }}
                style={[styles.chip, !manualUrl.trim() || urlLoading ? styles.disabled : undefined]}
              >
                <Text style={styles.chipText}>
                  {urlLoading ? t('trustlines.add.loading') : t('trustlines.add.load')}
                </Text>
              </Pressable>
            </View>
            {urlError ? <Text style={styles.errorText}>{urlError}</Text> : null}
            {urlAssets.map(asset => (
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
            ))}
            <Text style={styles.fieldLabel}>{t('trustlines.add.assetCode')}</Text>
            <TextInput
              autoCapitalize="characters"
              autoCorrect={false}
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
              onChangeText={setManualIssuer}
              placeholder={t('trustlines.add.issuerPlaceholder')}
              placeholderTextColor={theme.colors.textTertiary}
              style={styles.search}
              value={manualIssuer}
            />
          </ScrollView>
        ) : (
          <>
            <View style={styles.filters}>
              {CURATED_ASSET_SOURCES.map(source => {
                const selectedSource = sources.includes(source.id);
                return (
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selectedSource }}
                    key={source.id}
                    onPress={() =>
                      setSources(current =>
                        current.includes(source.id) ? current.filter(id => id !== source.id) : [...current, source.id],
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
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setQuery}
              placeholder={t('trustlines.add.search')}
              placeholderTextColor={theme.colors.textTertiary}
              style={styles.search}
              value={query}
            />
            {sources.length === 0 ? (
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

async function loadListedAssets(
  balanceDependencies: BalanceDependencies,
  account: AccountRecord,
  sources: readonly CuratedAssetSourceId[],
): Promise<readonly ListedAsset[]> {
  const held = await heldAssetKeys(balanceDependencies, account);
  const selected = CURATED_ASSET_SOURCES.filter(source => sources.includes(source.id));
  if (selected.length === 0) return [];
  const results = await Promise.allSettled(selected.map(source => readSource(source.url)));
  const merged = new Map<string, CuratedAsset>();
  let successes = 0;
  results.forEach(result => {
    if (result.status !== 'fulfilled') return;
    successes += 1;
    for (const asset of result.value) merged.set(assetKey(asset), asset);
  });
  if (successes === 0) throw new Error('curated-source-unavailable');
  return [...merged.values()].map(asset => ({ ...asset, added: held.has(assetKey(asset)) }));
}

async function loadManualUrl(url: string, known: readonly ListedAsset[]): Promise<readonly ListedAsset[]> {
  const trimmed = url.trim();
  const target = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const body = await readText(target);
  const parsed = parseManualAssetDocument(body);
  const found = parsed.length > 0 ? parsed : await readWellKnownToml(target);
  const held = new Set(known.filter(asset => asset.added).map(assetKey));
  return found.map(asset => ({ ...asset, added: held.has(assetKey(asset)) }));
}

async function readWellKnownToml(pageUrl: string): Promise<readonly CuratedAsset[]> {
  const origin = new URL(pageUrl).origin;
  const body = await readText(`${origin}/.well-known/stellar.toml`);
  return parseManualAssetDocument(body);
}

async function readSource(url: string): Promise<readonly CuratedAsset[]> {
  return normalizeCuratedAssets(JSON.parse(await readText(url)) as unknown);
}

async function readText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json, text/plain, */*',
      'User-Agent': 'Fresnica',
    },
  });
  if (!response.ok) throw new Error('curated-source-unavailable');
  return response.text();
}

async function heldAssetKeys(balanceDependencies: BalanceDependencies, account: AccountRecord): Promise<Set<string>> {
  try {
    const snapshot = await loadBalanceSnapshot(
      { gateway: balanceDependencies.gateway, networkId: balanceDependencies.networkId },
      account,
    );
    if (snapshot.status !== 'active') return new Set();
    return new Set(
      snapshot.balances
        .filter(
          (line): line is typeof line & { asset: { kind: 'credit'; code: string; issuer: string } } =>
            line.asset.kind === 'credit',
        )
        .map(line => `${line.asset.code}:${line.asset.issuer}`),
    );
  } catch {
    return new Set();
  }
}

function assetKey(asset: Readonly<{ code: string; issuer: string }>): string {
  return `${asset.code}:${asset.issuer}`;
}
