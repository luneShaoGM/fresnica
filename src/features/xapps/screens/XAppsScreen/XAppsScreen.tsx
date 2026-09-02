import React, {useMemo, useState} from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import {useAppTheme, useThemedStyles} from '../../../../ui/theme';
import {createStyles} from './styles';

const CATEGORIES = ['All', 'Wallet', 'Tools', 'Games', 'NFT'] as const;

type Section = 'home' | 'recent';

export function XAppsScreen() {
  const theme = useAppTheme();
  const styles = useThemedStyles(createStyles);
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
            placeholderTextColor={theme.colors.textTertiary}
            returnKeyType="search"
            style={styles.searchInput}
            value={searchText}
          />
        </View>

        <View style={styles.segment}>
          <SegmentButton label="Home" selected={section === 'home'} onPress={() => setSection('home')} styles={styles} />
          <SegmentButton label="Recent" selected={section === 'recent'} onPress={() => setSection('recent')} styles={styles} />
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
            <SectionTitle title="Development dApps" styles={styles} />
            <AppRow
              initials="DEV"
              title="Fresnica dApp preview"
              subtitle="Browser and authorization wiring is not enabled yet"
              disabled
              styles={styles}
            />
            <SectionTitle title="Our suggestions" styles={styles} />
            <EmptyCatalog message={emptyMessage} styles={styles} />
            <SectionTitle title="All" styles={styles} />
            <EmptyCatalog
              message="All catalog entries will use this original Stellar list layout once the catalog boundary is connected."
              styles={styles}
            />
          </>
        ) : (
          <>
            <SectionTitle title={section === 'recent' ? 'Recently used' : category} styles={styles} />
            <EmptyCatalog message={emptyMessage} styles={styles} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

type Styles = ReturnType<typeof createStyles>;

function SegmentButton({
  label,
  selected,
  onPress,
  styles,
}: Readonly<{label: string; selected: boolean; onPress: () => void; styles: Styles}>) {
  return (
    <Pressable onPress={onPress} style={[styles.segmentButton, selected ? styles.segmentButtonSelected : undefined]}>
      <Text style={[styles.segmentText, selected ? styles.segmentTextSelected : undefined]}>{label}</Text>
    </Pressable>
  );
}

function SectionTitle({title, styles}: Readonly<{title: string; styles: Styles}>) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function AppRow({
  initials,
  title,
  subtitle,
  disabled = false,
  styles,
}: Readonly<{
  initials: string;
  title: string;
  subtitle: string;
  disabled?: boolean;
  styles: Styles;
}>) {
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

function EmptyCatalog({message, styles}: Readonly<{message: string; styles: Styles}>) {
  return (
    <View style={styles.emptyCatalog}>
      <View style={styles.emptyIcon}><Text style={styles.emptyGlyph}>◎</Text></View>
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );
}
