import React from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';

import {Screen} from '@ui/components';

import {useThemedStyles, type AppTheme} from '../../ui/theme';

type Props = Readonly<{
  onBack: () => void;
  appName: string;
  projectName: string;
}>;

export function AboutScreen({onBack, appName, projectName}: Props) {
  const styles = useThemedStyles(createStyles);

  return (
    <Screen scrollable={false} contentInset="none">
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back" accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
        <Text style={styles.title}>About</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.logo}>
            <View style={styles.logoDot} />
          </View>
          <Text style={styles.appName}>{appName}</Text>
          <Text style={styles.tagline}>Stellar wallet powered by the Fresnica Native SDK security boundary.</Text>
        </View>

        <View style={styles.rows}>
          <InfoRow label="Project" value={projectName} />
          <InfoRow label="Network" value="Stellar Testnet" />
          <InfoRow label="Runtime" value="React Native 0.87" />
          <InfoRow label="Security" value="Fresnica Native SDK" />
        </View>

        <View style={styles.note}>
          <Text style={styles.noteTitle}>Compatibility</Text>
          <Text style={styles.noteText}>
            Native SDK and adapter compatibility is enforced at the platform boundary. Detailed diagnostics remain
            developer/support tooling rather than wallet state.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

function InfoRow({label, value}: Readonly<{label: string; value: string}>) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text numberOfLines={2} style={styles.infoValue}>
        {value}
      </Text>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    safeArea: {flex: 1, backgroundColor: theme.colors.background},
    header: {
      minHeight: 58,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    backButton: {width: 42, height: 42, alignItems: 'center', justifyContent: 'center'},
    backGlyph: {fontSize: 36, lineHeight: 38, fontWeight: '300', color: theme.colors.secondary},
    title: {fontSize: 18, lineHeight: 22, fontWeight: '800', color: theme.colors.textPrimary},
    headerSpacer: {width: 42},
    content: {paddingBottom: 38},
    hero: {alignItems: 'center', paddingHorizontal: 30, paddingTop: 34, paddingBottom: 30, gap: 10},
    logo: {
      width: 74,
      height: 74,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surfaceStrong,
    },
    logoDot: {width: 26, height: 26, borderRadius: 13, backgroundColor: theme.colors.actionPrimary},
    appName: {fontSize: 22, lineHeight: 27, fontWeight: '800', color: theme.colors.textPrimary},
    tagline: {fontSize: 12, lineHeight: 17, color: theme.colors.textSecondary, textAlign: 'center'},
    rows: {borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border},
    infoRow: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 18,
      gap: 18,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    infoLabel: {fontSize: 13, lineHeight: 17, color: theme.colors.textPrimary, fontWeight: '600'},
    infoValue: {flex: 1, fontSize: 12, lineHeight: 16, color: theme.colors.textSecondary, textAlign: 'right'},
    note: {
      marginHorizontal: 18,
      marginTop: 24,
      padding: 15,
      borderRadius: 12,
      backgroundColor: theme.colors.surfaceMuted,
      gap: 6,
    },
    noteTitle: {fontSize: 13, lineHeight: 17, fontWeight: '800', color: theme.colors.secondary},
    noteText: {fontSize: 11, lineHeight: 16, color: theme.colors.textSecondary},
  });
}
