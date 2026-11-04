import React from 'react';
import { SectionList, Text, View } from 'react-native';
import { useThemedStyles } from '@ui/theme';
import { createStyles } from './styles';

export type SectionedListSection<T> = Readonly<{ title: string; data: readonly T[] }>;

export function SectionedList<T>({
  sections,
  keyExtractor,
  renderItem,
  empty,
}: Readonly<{
  sections: readonly SectionedListSection<T>[];
  keyExtractor(item: T): string;
  renderItem(item: T): React.ReactElement;
  empty?: React.ReactElement;
}>) {
  const styles = useThemedStyles(createStyles);
  return (
    <SectionList
      sections={sections}
      ListEmptyComponent={empty}
      keyExtractor={keyExtractor}
      renderItem={({ item }) => renderItem(item)}
      renderSectionHeader={({ section }) => (
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.heading}>
            {section.title}
          </Text>
        </View>
      )}
      keyboardShouldPersistTaps="handled"
      stickySectionHeadersEnabled={false}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.content}
      style={styles.list}
    />
  );
}
