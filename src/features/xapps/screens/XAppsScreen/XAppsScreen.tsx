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
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState('');

  const emptyMessage = useMemo(() => {
    if (searchOpen) {
      return searchText.trim()
        ? `No dApps match “${searchText.trim()}”.`
        : 'Type a name to search the dApp catalog.';
    }
    if (section === 'recent') {
      return 'Recently used dApps will appear here when dApp authorization is available.';
    }
    if (category !== 'All') {
      return `No ${category.toLowerCase()} dApps are available in this preview.`;
    }
    return 'The dApp catalog is not connected in this preview.';
  }, [category, searchOpen, searchText, section]);

  const closeSearch = () => {
    setSearchText('');
    setSearchOpen(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>dApps</Text>
          <View style={styles.headerActions}>
            {searchOpen ? (
              <Pressable
                accessibilityRole="button"
                onPress={closeSearch}
                style={({pressed}) => [styles.cancelButton, pressed ? styles.pressed : undefined]}>
                <Text style={styles.cancelText}>Cancel</Text>
                <Text style={styles.cancelGlyph}>×</Text>
              </Pressable>
            ) : (
              <Pressable
                accessibilityLabel="Search dApps"
                accessibilityRole="button"
                onPress={() => setSearchOpen(true)}
                style={({pressed}) => [styles.headerAction, pressed ? styles.pressed : undefined]}>
                <Text style={styles.headerGlyph}>⌕</Text>
              </Pressable>
            )}
            <View
              accessibilityLabel="Open custom dApp URL"
              accessibilityRole="button"
              accessibilityState={{disabled: true}}
              style={[styles.headerAction, styles.headerActionDisabled]}>
              <Text style={styles.globeGlyph}>◎</Text>
            </View>
          </View>
        </View>

        {searchOpen ? (
          <>
            <View style={styles.searchBox}>
              <Text style={styles.searchGlyph}>⌕</Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
                onChangeText={setSearchText}
                placeholder="Search"
                placeholderTextColor={theme.colors.textTertiary}
                returnKeyType="search"
                style={styles.searchInput}
                value={searchText}
              />
            </View>
            <EmptyCatalog message={emptyMessage} styles={styles} />
          </>
        ) : (
          <>
            <View style={styles.segment}>
              <SegmentButton
                label="Home"
                selected={section === 'home'}
                onPress={() => setSection('home')}
                styles={styles}
              />
              <SegmentButton
                label="Recent"
                selected={section === 'recent'}
                onPress={() => setSection('recent')}
                styles={styles}
              />
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

function EmptyCatalog({message, styles}: Readonly<{message: string; styles: Styles}>) {
  return (
    <View style={styles.emptyCatalog}>
      <View style={styles.emptyIcon}><Text style={styles.emptyGlyph}>◎</Text></View>
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );
}
