import React, {useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, TextInput, View} from 'react-native';

import {palette, radius, spacing, typography} from '../../ui/theme';

type Section = 'home' | 'recent';

export function DAppsHomeScreen() {
  const [section, setSection] = useState<Section>('home');
  const [searching, setSearching] = useState(false);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        {searching ? (
          <TextInput
            autoFocus
            placeholder="Search"
            placeholderTextColor={palette.textMuted}
            style={styles.searchInput}
          />
        ) : (
          <Text style={styles.title}>dApps</Text>
        )}
        <View style={styles.headerActions}>
          <Pressable
            accessibilityLabel={searching ? 'Close search' : 'Search dApps'}
            onPress={() => setSearching(current => !current)}
            style={({pressed}) => [styles.headerAction, pressed ? styles.pressed : undefined]}>
            <Text style={styles.headerActionText}>{searching ? '×' : '⌕'}</Text>
          </Pressable>
          {!searching ? (
            <View accessibilityLabel="Open custom dApp URL" style={styles.headerAction}>
              <Text style={styles.headerActionText}>◎</Text>
            </View>
          ) : null}
        </View>
      </View>

      {!searching ? (
        <>
          <View style={styles.segment}>
            <Segment label="Home" selected={section === 'home'} onPress={() => setSection('home')} />
            <Segment label="Recent" selected={section === 'recent'} onPress={() => setSection('recent')} />
          </View>
          {section === 'home' ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {['All', 'Finance', 'Utilities', 'Games', 'Development'].map(label => (
                <View key={label} style={styles.chip}>
                  <Text style={styles.chipText}>{label}</Text>
                </View>
              ))}
            </ScrollView>
          ) : null}
        </>
      ) : null}

      <ScrollView contentContainerStyle={styles.content}>
        {searching ? (
          <EmptyState title="Search dApps" detail="The Fresnica dApp catalog adapter has not been connected yet." />
        ) : section === 'recent' ? (
          <EmptyState title="Recently used" detail="No recently used dApps." />
        ) : (
          <>
            <SectionTitle>Development DApps</SectionTitle>
            <EmptyRow label="No development dApps available in this build" />
            <SectionTitle>Our suggestions</SectionTitle>
            <EmptyRow label="Catalog integration pending" />
            <SectionTitle>All</SectionTitle>
            <EmptyRow label="Catalog integration pending" />
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Segment({
  label,
  selected,
  onPress,
}: Readonly<{label: string; selected: boolean; onPress: () => void}>) {
  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => [
        styles.segmentButton,
        selected ? styles.segmentButtonSelected : undefined,
        pressed ? styles.pressed : undefined,
      ]}>
      <Text style={[styles.segmentText, selected ? styles.segmentTextSelected : undefined]}>{label}</Text>
    </Pressable>
  );
}

function SectionTitle({children}: React.PropsWithChildren) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function EmptyRow({label}: Readonly<{label: string}>) {
  return (
    <View style={styles.appRow}>
      <View style={styles.appIcon} />
      <View style={styles.appCopy}>
        <Text style={styles.appName}>{label}</Text>
        <Text style={styles.appDescription}>dApp presentation is restored before catalog/browser behavior is reconnected.</Text>
      </View>
      <Text style={styles.about}>About</Text>
    </View>
  );
}

function EmptyState({title, detail}: Readonly<{title: string; detail: string}>) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDetail}>{detail}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: palette.background},
  header: {
    minHeight: 68,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {...typography.title, color: palette.text},
  headerActions: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
  headerAction: {width: 36, height: 36, alignItems: 'center', justifyContent: 'center'},
  headerActionText: {fontSize: 24, color: palette.text, lineHeight: 28},
  searchInput: {
    flex: 1,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: palette.tint,
    paddingHorizontal: spacing.md,
    ...typography.body,
    color: palette.text,
  },
  segment: {
    marginHorizontal: spacing.lg,
    flexDirection: 'row',
    backgroundColor: palette.tint,
    borderRadius: radius.md,
    padding: 3,
  },
  segmentButton: {flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 9},
  segmentButtonSelected: {backgroundColor: palette.surface},
  segmentText: {...typography.label, color: palette.textMuted},
  segmentTextSelected: {color: palette.text},
  chips: {paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm},
  chip: {backgroundColor: palette.tint, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 8},
  chipText: {...typography.caption, color: palette.text, fontWeight: '700'},
  content: {paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl},
  sectionTitle: {...typography.sectionTitle, color: palette.text, marginTop: spacing.lg, marginBottom: spacing.sm},
  appRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  appIcon: {width: 48, height: 48, borderRadius: radius.md, backgroundColor: palette.tint},
  appCopy: {flex: 1, gap: 3},
  appName: {...typography.body, color: palette.text, fontWeight: '700'},
  appDescription: {...typography.caption, color: palette.textMuted},
  about: {...typography.label, color: palette.accent},
  emptyState: {paddingVertical: spacing.xxl, alignItems: 'center', gap: spacing.sm},
  emptyTitle: {...typography.sectionTitle, color: palette.text},
  emptyDetail: {...typography.body, color: palette.textMuted, textAlign: 'center'},
  pressed: {opacity: 0.65},
});
