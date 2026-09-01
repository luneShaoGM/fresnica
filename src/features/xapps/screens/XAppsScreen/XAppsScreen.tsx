import React, {useMemo, useState} from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const CATEGORIES = ['All', 'Wallet', 'Tools', 'Games', 'NFT'] as const;

type Section = 'home' | 'recent';

export function XAppsScreen() {
  const [section, setSection] = useState<Section>('home');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('All');
  const [searchText, setSearchText] = useState('');

  const emptyMessage = useMemo(() => {
    if (searchText.trim()) {
      return `No dApps match “${searchText.trim()}” in this preview.`;
    }
    if (section === 'recent') {
      return 'Recently used dApps will appear here after the dApp authorization stage is connected.';
    }
    if (category !== 'All') {
      return `${category} dApps will appear here when the catalog boundary is enabled.`;
    }
    return 'The dApp catalog is intentionally not connected in this preview yet.';
  }, [category, searchText, section]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>dApps</Text>
          <View style={styles.headerActions}>
            <View style={styles.headerIcon}><Text style={styles.headerGlyph}>⌕</Text></View>
            <View style={styles.headerIcon}><Text style={styles.headerGlyph}>◎</Text></View>
          </View>
        </View>

        <View style={styles.searchBox}>
          <Text style={styles.searchGlyph}>⌕</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setSearchText}
            placeholder="Search dApps"
            placeholderTextColor="#ACB1C1"
            returnKeyType="search"
            style={styles.searchInput}
            value={searchText}
          />
        </View>

        <View style={styles.segment}>
          <SegmentButton label="Home" selected={section === 'home'} onPress={() => setSection('home')} />
          <SegmentButton label="Recent" selected={section === 'recent'} onPress={() => setSection('recent')} />
        </View>

        {section === 'home' ? (
          <ScrollView
            contentContainerStyle={styles.categories}
            horizontal
            showsHorizontalScrollIndicator={false}>
            {CATEGORIES.map(item => (
              <Pressable
                key={item}
                onPress={() => setCategory(item)}
                style={[styles.chip, category === item ? styles.chipSelected : undefined]}>
                <Text style={[styles.chipText, category === item ? styles.chipTextSelected : undefined]}>
                  {item}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        {section === 'home' && category === 'All' && !searchText.trim() ? (
          <>
            <SectionTitle title="Development dApps" />
            <AppRow
              initials="DEV"
              title="Fresnica dApp preview"
              subtitle="Browser and authorization wiring is not enabled yet"
              disabled
            />
            <SectionTitle title="Our suggestions" />
            <EmptyCatalog message={emptyMessage} />
            <SectionTitle title="All" />
            <EmptyCatalog message="All catalog entries will use this original Stellar list layout once the catalog boundary is connected." />
          </>
        ) : (
          <>
            <SectionTitle title={section === 'recent' ? 'Recently used' : category} />
            <EmptyCatalog message={emptyMessage} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SegmentButton({
  label,
  selected,
  onPress,
}: Readonly<{label: string; selected: boolean; onPress: () => void}>) {
  return (
    <Pressable onPress={onPress} style={[styles.segmentButton, selected ? styles.segmentButtonSelected : undefined]}>
      <Text style={[styles.segmentText, selected ? styles.segmentTextSelected : undefined]}>{label}</Text>
    </Pressable>
  );
}

function SectionTitle({title}: Readonly<{title: string}>) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function AppRow({
  initials,
  title,
  subtitle,
  disabled = false,
}: Readonly<{initials: string; title: string; subtitle: string; disabled?: boolean}>) {
  return (
    <View style={[styles.appRow, disabled ? styles.appRowDisabled : undefined]}>
      <View style={styles.appIcon}><Text style={styles.appInitials}>{initials}</Text></View>
      <View style={styles.appIdentity}>
        <Text style={styles.appTitle}>{title}</Text>
        <Text numberOfLines={2} style={styles.appSubtitle}>{subtitle}</Text>
      </View>
      <View style={styles.aboutButton}><Text style={styles.aboutText}>About</Text></View>
    </View>
  );
}

function EmptyCatalog({message}: Readonly<{message: string}>) {
  return (
    <View style={styles.emptyCatalog}>
      <View style={styles.emptyIcon}><Text style={styles.emptyGlyph}>◎</Text></View>
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {flex: 1, backgroundColor: '#FFFFFF'},
  content: {paddingHorizontal: 18, paddingTop: 8, paddingBottom: 34},
  header: {minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  title: {fontSize: 28, lineHeight: 34, fontWeight: '800', color: '#000000', letterSpacing: -0.6},
  headerActions: {flexDirection: 'row', gap: 8},
  headerIcon: {width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F6FA'},
  headerGlyph: {fontSize: 18, color: '#181D41', fontWeight: '700'},
  searchBox: {
    height: 42,
    borderRadius: 10,
    backgroundColor: '#F3F6FA',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
    marginTop: 8,
    marginBottom: 12,
  },
  searchGlyph: {fontSize: 20, color: '#606885'},
  searchInput: {flex: 1, color: '#000000', fontSize: 14, paddingVertical: 0},
  segment: {height: 42, borderRadius: 10, backgroundColor: '#F3F6FA', padding: 3, flexDirection: 'row', marginBottom: 12},
  segmentButton: {flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 8},
  segmentButtonSelected: {backgroundColor: '#FFFFFF'},
  segmentText: {fontSize: 13, color: '#606885', fontWeight: '600'},
  segmentTextSelected: {color: '#000000', fontWeight: '800'},
  categories: {gap: 8, paddingBottom: 8},
  chip: {height: 32, borderRadius: 16, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F6FA'},
  chipSelected: {backgroundColor: '#181D41'},
  chipText: {fontSize: 11, color: '#606885', fontWeight: '700'},
  chipTextSelected: {color: '#FFFFFF'},
  sectionTitle: {fontSize: 17, lineHeight: 21, fontWeight: '800', color: '#000000', paddingTop: 17, paddingBottom: 8},
  appRow: {minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E7EAF0'},
  appRowDisabled: {opacity: 0.62},
  appIcon: {width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#181D41'},
  appInitials: {fontSize: 11, color: '#FFFFFF', fontWeight: '800'},
  appIdentity: {flex: 1, gap: 3},
  appTitle: {fontSize: 14, lineHeight: 18, fontWeight: '800', color: '#000000'},
  appSubtitle: {fontSize: 11, lineHeight: 15, color: '#606885'},
  aboutButton: {minWidth: 56, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F6FA', paddingHorizontal: 10},
  aboutText: {fontSize: 10, color: '#606885', fontWeight: '700'},
  emptyCatalog: {minHeight: 104, borderRadius: 12, backgroundColor: '#F3F6FA', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 7},
  emptyIcon: {width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF'},
  emptyGlyph: {fontSize: 17, color: '#ACB1C1'},
  emptyText: {fontSize: 11, lineHeight: 16, color: '#606885', textAlign: 'center'},
});
