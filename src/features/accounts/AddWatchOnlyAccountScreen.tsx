import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {Screen} from '@ui/components';
import {useAppTheme, useThemedStyles, type AppTheme} from '@ui/theme';
import {projectFeatureError} from '../featureError';

import {
  runWatchOnlyOnboarding,
  type OnboardingProvisioningDependencies,
} from '../onboarding/runOnboardingProvisioning';

type Props = Readonly<{
  dependencies: OnboardingProvisioningDependencies;
  onComplete: () => void;
  onCancel: () => void;
}>;

export function AddWatchOnlyAccountScreen({ dependencies, onComplete, onCancel }: Props) {
  const theme = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const [label, setLabel] = useState('');
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function submit() {
    setBusy(true);
    setError(undefined);
    try {
      await runWatchOnlyOnboarding(dependencies, { address, label });
      onComplete();
    } catch (caught) {
      setError(projectFeatureError(caught, {fallbackMessage: 'Unable to add account.'}).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen scrollable={false} contentInset="none">
      <View style={styles.header}>
        <Pressable accessibilityLabel="Cancel" disabled={busy} onPress={onCancel} style={styles.backButton}>
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Add account</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Text style={styles.heroGlyph}>◎</Text>
          </View>
          <Text style={styles.title}>Watch-only account</Text>
          <Text style={styles.description}>Track another Stellar address without adding local signing authority.</Text>
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            Adding another protected software signer remains disabled until Fresnica can verify the wallet's existing
            app passphrase through a framework-safe native operation.
          </Text>
        </View>

        <Text style={styles.fieldLabel}>ACCOUNT LABEL</Text>
        <TextInput
          editable={!busy}
          onChangeText={setLabel}
          placeholder="Additional account"
          placeholderTextColor={theme.colors.textTertiary}
          style={styles.input}
          value={label}
        />

        <Text style={styles.fieldLabel}>STELLAR ADDRESS</Text>
        <TextInput
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!busy}
          onChangeText={setAddress}
          placeholder="G... or C..."
          placeholderTextColor={theme.colors.textTertiary}
          style={[styles.input, styles.addressInput]}
          value={address}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <View style={styles.bottomBar}>
        <Pressable
          disabled={busy || address.trim().length === 0}
          onPress={() => void submit()}
          style={({ pressed }) => [
            styles.addButton,
            busy || address.trim().length === 0 ? styles.addButtonDisabled : undefined,
            pressed ? styles.pressed : undefined,
          ]}
        >
          {busy ? <ActivityIndicator color={theme.colors.onActionPrimary} /> : <Text style={styles.addButtonText}>Add account</Text>}
        </Pressable>
      </View>
    </Screen>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
  header: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  backButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  backGlyph: { fontSize: 36, lineHeight: 38, fontWeight: '300', color: theme.colors.surfaceStrong },
  headerTitle: { fontSize: 18, lineHeight: 22, fontWeight: '800', color: theme.colors.textPrimary },
  headerSpacer: { width: 42 },
  content: { paddingHorizontal: 18, paddingBottom: 28 },
  hero: { alignItems: 'center', paddingTop: 30, paddingBottom: 20, gap: 8 },
  heroIcon: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceStrong,
  },
  heroGlyph: { fontSize: 27, color: theme.colors.actionPrimary, fontWeight: '700' },
  title: { fontSize: 20, lineHeight: 25, color: theme.colors.textPrimary, fontWeight: '800' },
  description: { fontSize: 12, lineHeight: 17, color: theme.colors.textSecondary, textAlign: 'center' },
  notice: { borderRadius: 11, backgroundColor: theme.colors.surfaceMuted, padding: 13, marginBottom: 6 },
  noticeText: { fontSize: 10, lineHeight: 15, color: theme.colors.textSecondary },
  fieldLabel: { paddingTop: 18, paddingBottom: 7, fontSize: 10, lineHeight: 13, color: theme.colors.textTertiary, fontWeight: '800' },
  input: {
    minHeight: 52,
    borderRadius: 10,
    backgroundColor: theme.colors.surfaceMuted,
    paddingHorizontal: 14,
    color: theme.colors.textPrimary,
    fontSize: 14,
  },
  addressInput: { fontSize: 12, fontVariant: ['tabular-nums'] },
  error: {
    marginTop: 15,
    borderRadius: 9,
    padding: 12,
    backgroundColor: theme.colors.negativeMuted,
    color: theme.colors.negative,
    fontSize: 11,
    lineHeight: 16,
  },
  bottomBar: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  addButton: {
    minHeight: 54,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.actionPrimary,
  },
  addButtonDisabled: { opacity: 0.45 },
  addButtonText: { fontSize: 15, lineHeight: 19, color: theme.colors.onActionPrimary, fontWeight: '800' },
  pressed: { opacity: 0.68 },
  });
}
