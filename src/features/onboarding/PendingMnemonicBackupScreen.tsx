import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Screen } from '@ui/components';

import type { ProvisionAccountDependencies } from '../../capabilities/account/provisionAccount';
import {
  getSystemAuthStatus,
  type ApplicationSecurityDependencies,
} from '../../capabilities/application-security/systemAuth';
import { projectFeatureError } from '../featureError';
import { useLocalization } from '../../locale';
import { useAppTheme, useThemedStyles, type AppTheme } from '../../ui/theme';
import { MnemonicBackupVerification } from './MnemonicBackupVerification';
import {
  completeMnemonicBackup,
  recoverPendingMnemonicBackup,
  type RecoveredMnemonicBackup,
} from './onboardingBootstrap';

type Props = Readonly<{
  dependencies: ProvisionAccountDependencies;
  signerId: string;
  securityDependencies?: ApplicationSecurityDependencies;
  onComplete: () => void | Promise<void>;
}>;

export function PendingMnemonicBackupScreen({ dependencies, signerId, securityDependencies, onComplete }: Props) {
  const theme = useAppTheme();
  const { t } = useLocalization();
  const styles = useThemedStyles(createStyles);
  const [appPassphrase, setAppPassphrase] = useState('');
  const [backup, setBackup] = useState<RecoveredMnemonicBackup>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [systemAuthRepairRequired, setSystemAuthRepairRequired] = useState(false);

  useEffect(() => {
    if (!securityDependencies) return;
    let mounted = true;
    getSystemAuthStatus(securityDependencies)
      .then(status => {
        if (mounted) {
          setSystemAuthRepairRequired(
            status.domainInitialized && status.enrolledSignerCount < status.protectedSignerCount,
          );
        }
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, [securityDependencies]);

  async function recover() {
    setBusy(true);
    setError(undefined);
    try {
      const recovered = await recoverPendingMnemonicBackup(dependencies, signerId, appPassphrase);
      setAppPassphrase('');
      setBackup(recovered);
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setBusy(true);
    setError(undefined);
    try {
      await completeMnemonicBackup(dependencies, signerId, onComplete);
      setBackup(undefined);
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen scrollable={false} contentInset="none">
      <View style={styles.header}>
        <Text style={styles.brand}>fresnica</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.securityMark}>
            <Text style={styles.securityGlyph}>⌁</Text>
          </View>
          <Text style={styles.title}>Finish recovery phrase backup</Text>
          <Text style={styles.body}>
            {backup
              ? 'Write these words down in order and store them offline. They are shown only for this explicit backup step.'
              : 'Fresnica did not store the plaintext phrase. Enter your app passphrase to reveal it again through Fresnica Core and finish the interrupted backup.'}
          </Text>
        </View>

        {backup ? (
          <MnemonicBackupVerification disabled={busy} mnemonic={backup.mnemonic} onVerified={confirm} />
        ) : (
          <View style={styles.formCard}>
            <Text style={styles.label}>App passphrase</Text>
            <TextInput
              autoCapitalize="none"
              secureTextEntry
              value={appPassphrase}
              onChangeText={setAppPassphrase}
              placeholder="Enter your app passphrase"
              placeholderTextColor={theme.colors.textTertiary}
              selectionColor={theme.colors.actionPrimary}
              style={styles.input}
            />
            <View style={styles.infoRow}>
              <Text style={styles.infoGlyph}>i</Text>
              <Text style={styles.infoText}>
                The passphrase is used only to recover the pending backup through Fresnica Core.
              </Text>
            </View>
          </View>
        )}

        {systemAuthRepairRequired ? (
          <View style={styles.noticeBox}>
            <Text style={styles.noticeText}>{t('accounts.add.systemAuthRepair')}</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.error}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>

      {backup ? null : (
        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            disabled={busy || appPassphrase.length === 0}
            onPress={recover}
            style={({ pressed }) => [
              styles.primaryButton,
              busy || appPassphrase.length === 0 ? styles.disabled : undefined,
              pressed ? styles.primaryButtonPressed : undefined,
            ]}
          >
            {busy ? (
              <ActivityIndicator color={theme.colors.onActionPrimary} />
            ) : (
              <Text style={styles.primaryButtonText}>Reveal recovery phrase</Text>
            )}
          </Pressable>
        </View>
      )}
    </Screen>
  );
}

function readableError(error: unknown): string {
  return projectFeatureError(error, { fallbackMessage: 'Unable to continue.' }).message;
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.colors.background },
    header: { height: 60, justifyContent: 'center', paddingHorizontal: 20 },
    brand: { color: theme.colors.textPrimary, fontSize: 24, lineHeight: 30, fontWeight: '800', letterSpacing: -0.6 },
    scroll: { flexGrow: 1, paddingBottom: 24 },
    hero: { alignItems: 'center', paddingHorizontal: 26, paddingTop: 28, paddingBottom: 24 },
    securityMark: {
      width: 68,
      height: 68,
      borderRadius: 34,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.actionPrimaryDecoration,
      marginBottom: 18,
    },
    securityGlyph: { color: theme.colors.actionPrimaryPressed, fontSize: 34, lineHeight: 38, fontWeight: '800' },
    title: {
      color: theme.colors.textPrimary,
      fontSize: 25,
      lineHeight: 31,
      fontWeight: '800',
      textAlign: 'center',
      letterSpacing: -0.5,
    },
    body: {
      color: theme.colors.textSecondary,
      fontSize: 14,
      lineHeight: 21,
      textAlign: 'center',
      marginTop: 9,
      maxWidth: 350,
    },
    formCard: {
      marginHorizontal: 20,
      padding: 16,
      borderRadius: 12,
      backgroundColor: theme.colors.surfaceMuted,
      gap: 8,
    },
    label: { color: theme.colors.textPrimary, fontSize: 13, lineHeight: 17, fontWeight: '700' },
    input: {
      minHeight: 48,
      borderRadius: 9,
      backgroundColor: theme.colors.surface,
      color: theme.colors.textPrimary,
      fontSize: 15,
      paddingHorizontal: 13,
    },
    infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 4 },
    infoGlyph: {
      width: 18,
      height: 18,
      borderRadius: 9,
      textAlign: 'center',
      backgroundColor: theme.colors.surfaceStrong,
      color: theme.colors.onSurfaceStrong,
      fontSize: 11,
      lineHeight: 18,
      fontWeight: '800',
    },
    infoText: { flex: 1, color: theme.colors.textSecondary, fontSize: 11, lineHeight: 17 },
    noticeBox: {
      marginHorizontal: 20,
      marginTop: 14,
      borderRadius: 9,
      backgroundColor: theme.colors.surfaceMuted,
      padding: 11,
    },
    noticeText: { color: theme.colors.textSecondary, fontSize: 12, lineHeight: 18, fontWeight: '600' },
    errorBox: {
      marginHorizontal: 20,
      marginTop: 14,
      borderRadius: 9,
      backgroundColor: theme.colors.negativeMuted,
      padding: 11,
    },
    error: { color: theme.colors.negativeStrong, fontSize: 12, lineHeight: 18, fontWeight: '600' },
    footer: {
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
    },
    primaryButton: {
      minHeight: 50,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.actionPrimary,
      paddingHorizontal: 18,
    },
    primaryButtonPressed: { backgroundColor: theme.colors.actionPrimaryPressed },
    primaryButtonText: { color: theme.colors.onActionPrimary, fontSize: 15, lineHeight: 20, fontWeight: '800' },
    disabled: { opacity: 0.45 },
  });
}
