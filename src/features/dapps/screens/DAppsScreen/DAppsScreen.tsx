import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import type {
  DappCatalogEntry,
  DappCatalogPort,
} from '@capabilities/dapp-catalog/catalog';
import { catalogCategories, filterCatalogEntries } from '@capabilities/dapp-catalog/catalog';
import { NativeStateView, Screen } from '@ui/components';
import { useAppTheme, useThemedStyles } from '@ui/theme';

import { useLocalization } from '../../../../locale';
import { createStyles } from './styles';

type CatalogState =
  | Readonly<{ kind: 'loading' }>
  | Readonly<{ kind: 'unavailable' }>
  | Readonly<{ kind: 'error' }>
  | Readonly<{ kind: 'ready'; entries: readonly DappCatalogEntry[] }>;

type Section = 'home' | 'recent';

export function DAppsScreen({ catalog }: Readonly<{ catalog: DappCatalogPort }>) {
  const { t } = useLocalization();
  const theme = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const [section, setSection] = useState<Section>('home');
  const [category, setCategory] = useState<string>();
  const [searchText, setSearchText] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [state, setState] = useState<CatalogState>({ kind: 'loading' });

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
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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
                <View style={styles.searchBox}>
                  <TextInput
                    accessibilityLabel={t('dapps.catalog.search')}
                    autoCapitalize="none"
                    autoCorrect={false}
                    onChangeText={setSearchText}
                    placeholder={t('dapps.catalog.search')}
                    placeholderTextColor={theme.colors.textTertiary}
                    returnKeyType="search"
                    style={styles.searchInput}
                    value={searchText}
                  />
                </View>
                {categories.length > 0 ? (
                  <ScrollView contentContainerStyle={styles.categories} horizontal showsHorizontalScrollIndicator={false}>
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
              <EmptyCatalog message={t('dapps.catalog.unavailable')} styles={styles} />
            ) : (
              <>
                <EmptyCatalog message={t('dapps.catalog.error')} styles={styles} />
                <Pressable accessibilityRole="button" onPress={() => setRetryCount(value => value + 1)} style={styles.retryButton}>
                  <Text style={styles.retryText}>{t('dapps.catalog.retry')}</Text>
                </Pressable>
              </>
            )}
          </>
        )}
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
