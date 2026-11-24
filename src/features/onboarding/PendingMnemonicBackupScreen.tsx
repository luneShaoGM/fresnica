import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@ui/components';
import { AppBrandMark } from '@ui/components/AppBrandMark';

import type { ProvisionAccountDependencies } from '../../capabilities/account/provisionAccount';
import {
  getSystemAuthStatus,
  type ApplicationSecurityDependencies,
} from '../../capabilities/application-security/systemAuth';
import { projectFeatureError } from '../featureError';
import { useLocalization } from '../../locale';
import { useAppTheme, useThemedStyles, type AppTheme } from '../../ui/theme';
import { MnemonicBackupVerification, type MnemonicBackupVerificationHandle } from './MnemonicBackupVerification';
import { SensitiveTextInput, type SensitiveTextInputHandle } from './SensitiveTextInput';
import { useSensitiveFlowLifetime, type SensitiveFlowRequest } from './useSensitiveFlowLifetime';
import {
  completeMnemonicBackup,
  recoverPendingMnemonicBackup,
} from './onboardingBootstrap';

type Props = Readonly<{
  dependencies: ProvisionAccountDependencies;
  signerId: string;
  securityDependencies?: ApplicationSecurityDependencies;
  disabled?: boolean;
  completionError?: string;
  onComplete: () => void | Promise<void>;
}>;

export function PendingMnemonicBackupScreen({ dependencies, signerId, securityDependencies, disabled = false, completionError, onComplete }: Props) {
  const theme = useAppTheme();
  const { t } = useLocalization();
  const styles = useThemedStyles(createStyles);
  const passphraseInput = useRef<SensitiveTextInputHandle>(null);
  const verifier = useRef<MnemonicBackupVerificationHandle>(null);
  const pendingPhrase = useRef<{ mnemonic: string; owner: SensitiveFlowRequest } | undefined>(undefined);
  const [present, setPresent] = useState(false);
  const [backupVisible, setBackupVisible] = useState(false);
  const [error, setError] = useState<string>();
  const [completionErrorDismissed, setCompletionErrorDismissed] = useState(false);
  const [systemAuthRepairRequired, setSystemAuthRepairRequired] = useState(false);
  const lifetime = useSensitiveFlowLifetime(clearOwnedMaterial, () => undefined, dependencies, signerId);
  const { owns } = lifetime;
  const busy = lifetime.busy || disabled;
  const visibleError = error ?? (completionErrorDismissed ? undefined : completionError);
  const attachVerifier = useCallback((input: MnemonicBackupVerificationHandle | null) => {
    verifier.current = input;
    if (!input) return;
    const pending = pendingPhrase.current;
    pendingPhrase.current = undefined;
    if (pending && owns(pending.owner)) input.load(pending.mnemonic);
  }, [owns]);

  function clearOwnedMaterial(updateUi: boolean) {
    passphraseInput.current?.clear(false);
    pendingPhrase.current = undefined;
    verifier.current?.clear(updateUi);
    if (updateUi) {
      setPresent(false);
      setBackupVisible(false);
      setError(undefined);
      setCompletionErrorDismissed(true);
    }
  }

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
    if (disabled) return;
    const owner = lifetime.begin();
    if (!owner) return;
    const appPassphrase = passphraseInput.current?.consume() ?? '';
    setError(undefined);
    setCompletionErrorDismissed(true);
    try {
      const recovered = await recoverPendingMnemonicBackup(dependencies, signerId, appPassphrase);
      if (lifetime.isCurrent(owner)) {
        pendingPhrase.current = { mnemonic: recovered.mnemonic, owner };
        setBackupVisible(true);
      }
    } catch (caught) {
      if (lifetime.isCurrent(owner)) setError(readableError(caught));
    } finally {
      lifetime.finish(owner);
    }
  }

  async function confirm() {
    if (disabled) return;
    const owner = lifetime.begin();
    if (!owner) return;
    pendingPhrase.current = undefined;
    verifier.current?.clear();
    setBackupVisible(false);
    setError(undefined);
    try {
      await completeMnemonicBackup(dependencies, signerId, onComplete);
      if (lifetime.isCurrent(owner)) {
        verifier.current?.clear();
        setBackupVisible(false);
      }
    } catch (caught) {
      if (lifetime.isCurrent(owner)) setError(readableError(caught));
    } finally {
      lifetime.finish(owner);
    }
  }

  return (
    <Screen scrollable={false} contentInset="none">
      <View style={styles.header}>
        <View style={styles.brandLockup}>
          <AppBrandMark />
          <Text style={styles.brand}>Fresnica</Text>
        </View>
      </View>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.securityMark}>
            <Text allowFontScaling={false} accessible={false} style={styles.securityGlyph}>
              ⌁
            </Text>
          </View>
          <Text style={styles.title}>Finish recovery phrase backup</Text>
          <Text style={styles.body}>
            {backupVisible
              ? 'Write these words down in order and store them offline. They are shown only for this explicit backup step.'
              : 'Fresnica did not store the plaintext phrase. Enter your app passphrase to reveal it again through Fresnica Core and finish the interrupted backup.'}
          </Text>
        </View>

        {backupVisible ? (
          <MnemonicBackupVerification ref={attachVerifier} disabled={busy} onVerified={confirm} />
        ) : (
          <View style={styles.formCard}>
            <Text style={styles.label}>App passphrase</Text>
            <SensitiveTextInput
              ref={passphraseInput}
              accessibilityLabel="App passphrase"
              editable={!busy}
              autoCapitalize="none"
              secureTextEntry
              onTextChange={value => setPresent(value.length > 0)}
              placeholder="Enter your app passphrase"
              placeholderTextColor={theme.colors.textTertiary}
              selectionColor={theme.colors.actionPrimary}
              style={styles.input}
            />
            <View style={styles.infoRow}>
              <Text allowFontScaling={false} accessible={false} style={styles.infoGlyph}>
                i
              </Text>
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

        {visibleError ? (
          <View style={styles.errorBox}>
            <Text style={styles.error}>{visibleError}</Text>
          </View>
        ) : null}
        {backupVisible ? null : (
          <View style={styles.footer}>
            <Pressable
              accessibilityRole="button"
              disabled={busy || !present}
              onPress={recover}
              style={({ pressed }) => [
                styles.primaryButton,
                busy || !present ? styles.disabled : undefined,
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
      </ScrollView>
    </Screen>
  );
}

function readableError(error: unknown): string {
  return projectFeatureError(error, { fallbackMessage: 'Unable to continue.' }).message;
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.colors.background },
    header: { minHeight: 60, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: theme.spacing.sm },
    brandLockup: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs },
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
      marginTop: 'auto',
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
      paddingVertical: theme.spacing.sm,
    },
    primaryButtonPressed: { backgroundColor: theme.colors.actionPrimaryPressed },
    primaryButtonText: {
      textAlign: 'center',
      color: theme.colors.onActionPrimary,
      fontSize: 15,
      lineHeight: 20,
      fontWeight: '800',
    },
    disabled: { opacity: 0.45 },
  });
}
