import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import type {
  DappCatalogEntry,
  DappCatalogPort,
} from '@capabilities/dapp-catalog/catalog';
import { catalogCategories, filterCatalogEntries } from '@capabilities/dapp-catalog/catalog';
import { Screen } from '@ui/components';
import { NativeButton } from '@ui/components/NativeButton';
import { NativeField } from '@ui/components/NativeField';
import { NativeScreen } from '@ui/components/NativeScreen';
import { NativeStateView } from '@ui/components/NativeStateView';
import { useThemedStyles } from '@ui/theme';

import { useLocalization } from '../../../../locale';
import { createStyles } from './styles';

type CatalogState =
  | Readonly<{ kind: 'loading' }>
  | Readonly<{ kind: 'unavailable' }>
  | Readonly<{ kind: 'error' }>
  | Readonly<{ kind: 'ready'; entries: readonly DappCatalogEntry[] }>;

type Section = 'home' | 'recent';

export function DAppsScreen({
  catalog,
  showInterfaceSample = __DEV__,
}: Readonly<{ catalog: DappCatalogPort; showInterfaceSample?: boolean }>) {
  const { t } = useLocalization();
  const styles = useThemedStyles(createStyles);
  const [section, setSection] = useState<Section>('home');
  const [category, setCategory] = useState<string>();
  const [searchText, setSearchText] = useState('');
  const [sampleQuery, setSampleQuery] = useState('');
  const [sampleCategory, setSampleCategory] = useState<string>();
  const [retryCount, setRetryCount] = useState(0);
  const [state, setState] = useState<CatalogState>({ kind: 'loading' });
  const interfaceSamples = useMemo<readonly DappCatalogEntry[]>(() => [
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
  ], [t]);

  useEffect(() => {
    let current = true;
    setState({ kind: 'loading' });
    Promise.resolve()
      .then(() => catalog.load())
      .then(result => {
        if (!current) return;
        setState(result.kind === 'unavailable' ? { kind: 'unavailable' } : { kind: 'ready', entries: result.entries });
      })
      .catch(() => {
        if (current) setState({ kind: 'error' });
      });
    return () => {
      current = false;
    };
  }, [catalog, retryCount]);

  const categories = useMemo(() => state.kind === 'ready' ? catalogCategories(state.entries) : [], [state]);
  const selectedCategory = category !== undefined && categories.includes(category) ? category : undefined;
  const visibleEntries = useMemo(
    () => state.kind === 'ready' ? filterCatalogEntries(state.entries, selectedCategory, searchText) : [],
    [state, selectedCategory, searchText],
  );

  return (
    <Screen scrollable={false} contentInset="none">
      <NativeScreen padded={false} scroll>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('nav.dapps')}</Text>
          </View>

        <View style={styles.segment}>
          <SegmentButton label={t('dapps.catalog.home')} selected={section === 'home'} onPress={() => setSection('home')} styles={styles} />
          <SegmentButton label={t('dapps.catalog.recent')} selected={section === 'recent'} onPress={() => setSection('recent')} styles={styles} />
        </View>

        {section === 'recent' ? (
          <EmptyCatalog message={t('dapps.catalog.recentUnavailable')} styles={styles} />
        ) : (
          <>
            {state.kind === 'ready' ? (
              <>
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
                  <ScrollView style={styles.categoryRow} contentContainerStyle={styles.categories} horizontal showsHorizontalScrollIndicator={false}>
                    {[undefined, ...categories].map(item => (
                      <Pressable
                        key={item ?? 'all'}
                        accessibilityRole="button"
                        accessibilityState={{ selected: selectedCategory === item }}
                        onPress={() => setCategory(item)}
                        style={[styles.chip, selectedCategory === item ? styles.chipSelected : undefined]}>
                        <Text style={[styles.chipText, selectedCategory === item ? styles.chipTextSelected : undefined]}>
                          {item ?? t('dapps.catalog.all')}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                ) : null}
                <Text style={styles.sectionTitle}>{t('dapps.catalog.readOnly')}</Text>
                {visibleEntries.length > 0 ? visibleEntries.map(entry => (
                  <AppRow key={entry.id} entry={entry} styles={styles} />
                )) : (
                  <EmptyCatalog message={searchText.trim() || selectedCategory !== undefined ? t('dapps.catalog.noMatch') : t('dapps.catalog.empty')} styles={styles} />
                )}
              </>
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
      style={[styles.segmentButton, selected ? styles.segmentButtonSelected : undefined]}>
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
        <Text numberOfLines={2} style={styles.appSubtitle}>{entry.description}</Text>
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
      <ScrollView style={styles.categoryRow} contentContainerStyle={styles.categories} horizontal showsHorizontalScrollIndicator={false}>
        {[undefined, ...categories].map(item => (
          <Pressable
            key={item ?? 'all'}
            accessibilityRole="button"
            accessibilityState={{ selected: selectedCategory === item }}
            onPress={() => onCategory(item)}
            style={[styles.chip, selectedCategory === item ? styles.chipSelected : undefined]}>
            <Text style={[styles.chipText, selectedCategory === item ? styles.chipTextSelected : undefined]}>
              {item ?? t('dapps.catalog.all')}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <Text style={styles.sectionTitle}>{t('dapps.catalog.readOnly')}</Text>
      {visibleEntries.length > 0 ? visibleEntries.map(entry => (
        <AppRow key={entry.id} entry={entry} styles={styles} />
      )) : (
        <EmptyCatalog message={t('dapps.catalog.noMatch')} styles={styles} />
      )}
      <NativeButton label={t('dapps.catalog.previewClear')} onPress={onClear} variant="primary" />
    </>
  );
}
