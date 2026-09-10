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

import {
  NEW_PROTECTION_PASSPHRASE_MIN_UNICODE_SCALARS,
  assessNewProtectionPassphrase,
  assertNewProtectionPassphrase,
} from '../../capabilities/application-security/newPassphrasePolicy';
import { useAppTheme, useThemedStyles, type AppTheme } from '../../ui/theme';
import { confirmMnemonicBackup, type RecoveredMnemonicBackup } from './onboardingBootstrap';
import {projectFeatureError} from '../featureError';
import type { OnboardingMethod } from './onboardingState';
import {
  runGeneratedMnemonicOnboarding,
  runMnemonicImportOnboarding,
  runSecretImportOnboarding,
  runWatchOnlyOnboarding,
  type OnboardingProvisioningDependencies,
} from './runOnboardingProvisioning';

type Props = Readonly<{
  dependencies: OnboardingProvisioningDependencies;
  onComplete: () => void;
  onCancel?: () => void;
}>;

type GeneratedBackupState = RecoveredMnemonicBackup & {
  signerId: string;
};

export function OnboardingScreen({ dependencies, onComplete, onCancel }: Props) {
  const theme = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const [method, setMethod] = useState<OnboardingMethod>();
  const [label, setLabel] = useState('');
  const [address, setAddress] = useState('');
  const [secret, setSecret] = useState('');
  const [mnemonic, setMnemonic] = useState('');
  const [appPassphrase, setAppPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [generatedBackup, setGeneratedBackup] = useState<GeneratedBackupState>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const passphraseAssessment = assessNewProtectionPassphrase(appPassphrase);
  const passphraseConfirmationMatches =
    confirmPassphrase.length > 0 && appPassphrase === confirmPassphrase;
  const passphraseReady = passphraseAssessment.meetsMinimum && passphraseConfirmationMatches;

  function chooseMethod(nextMethod: OnboardingMethod) {
    clearSensitiveInputs();
    setGeneratedBackup(undefined);
    setError(undefined);
    setMethod(nextMethod);
  }

  function returnToMethodSelection() {
    clearSensitiveInputs();
    setAddress('');
    setError(undefined);
    setMethod(undefined);
  }

  function clearSensitiveInputs() {
    setSecret('');
    setMnemonic('');
    setAppPassphrase('');
    setConfirmPassphrase('');
  }

  function validatePassphrase() {
    assertNewProtectionPassphrase(appPassphrase);
    if (appPassphrase !== confirmPassphrase) {
      throw new Error('app-passphrase-confirmation-mismatch');
    }
  }

  async function submit() {
    if (!method) {
      return;
    }

    setBusy(true);
    setError(undefined);

    try {
      if (method === 'watch-only') {
        await runWatchOnlyOnboarding(dependencies, { address, label });
        onComplete();
        return;
      }

      validatePassphrase();

      if (method === 'import-secret') {
        await runSecretImportOnboarding(dependencies, {
          secret,
          appPassphrase,
          label,
        });
        clearSensitiveInputs();
        onComplete();
        return;
      }

      if (method === 'import-mnemonic') {
        await runMnemonicImportOnboarding(dependencies, {
          mnemonic,
          mnemonicPassphrase: '',
          index: 0,
          appPassphrase,
          label,
        });
        clearSensitiveInputs();
        onComplete();
        return;
      }

      const result = await runGeneratedMnemonicOnboarding(dependencies, {
        language: 'english',
        strength: 128,
        mnemonicPassphrase: '',
        index: 0,
        appPassphrase,
        label,
      });

      setGeneratedBackup({
        ...result.backup,
        signerId: result.account.signer.id,
      });
      clearSensitiveInputs();
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setBusy(false);
    }
  }

  function confirmGeneratedBackup() {
    if (!generatedBackup) {
      return;
    }

    try {
      confirmMnemonicBackup(dependencies, generatedBackup.signerId);
      setGeneratedBackup(undefined);
      onComplete();
    } catch (caught) {
      setError(readableError(caught));
    }
  }

  if (generatedBackup) {
    return (
      <FlowShell title="Recovery phrase">
        <View style={styles.backupHero}>
          <View style={styles.shieldMark}>
            <Text style={styles.shieldGlyph}>✓</Text>
          </View>
          <Text style={styles.heroTitle}>Back up your recovery phrase</Text>
          <Text style={styles.heroBody}>
            Write these words down in order and store them offline. Fresnica does not persist this plaintext phrase.
          </Text>
        </View>
        <RecoveryPhrase mnemonic={generatedBackup.mnemonic} />
        {error ? <ErrorText message={error} /> : null}
        <View style={styles.footer}>
          <PrimaryButton label="I have backed it up" onPress={confirmGeneratedBackup} />
        </View>
      </FlowShell>
    );
  }

  if (!method) {
    return (
      <Screen scrollable={false} contentInset="none">
        <View style={styles.brandHeader}>
          <Text style={styles.brand}>fresnica</Text>
          {onCancel ? (
            <Pressable
              accessibilityRole="button"
              onPress={onCancel}
              style={({ pressed }) => [styles.cancelButton, pressed ? styles.pressed : undefined]}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          ) : null}
        </View>
        <ScrollView contentContainerStyle={styles.methodScreen} showsVerticalScrollIndicator={false}>
          <View style={styles.introPanel}>
            <View style={styles.decorCircleLarge} />
            <View style={styles.decorCircleSmall} />
            <Text style={styles.introEyebrow}>STELLAR WALLET</Text>
            <Text style={styles.introTitle}>Set up Fresnica</Text>
            <Text style={styles.introBody}>
              Create a new wallet, import an existing signer, or add a watch-only account.
            </Text>
          </View>

          <View style={styles.methodSection}>
            <ChoiceButton
              glyph="+"
              title="Create new wallet"
              subtitle="Generate a new recovery phrase with Fresnica Core"
              primary
              onPress={() => chooseMethod('generate-mnemonic')}
            />
            <ChoiceButton
              glyph="↘"
              title="Import recovery phrase"
              subtitle="Protect an existing mnemonic locally"
              onPress={() => chooseMethod('import-mnemonic')}
            />
            <ChoiceButton
              glyph="K"
              title="Import Stellar secret"
              subtitle="Protect an existing S... secret locally"
              onPress={() => chooseMethod('import-secret')}
            />
            <ChoiceButton
              glyph="◎"
              title="Watch-only account"
              subtitle="Track an address without adding a local signer"
              onPress={() => chooseMethod('watch-only')}
            />
          </View>
        </ScrollView>
      </Screen>
    );
  }

  return (
    <FlowShell title={methodTitle(method)} onBack={returnToMethodSelection}>
      <View style={styles.formContent}>
        <Text style={styles.formIntro}>{methodDescription(method)}</Text>
        <Field label="Account label" value={label} onChangeText={setLabel} placeholder="Primary account" />

        {method === 'watch-only' ? (
          <Field
            label="Stellar address"
            value={address}
            onChangeText={setAddress}
            placeholder="G... or C..."
            autoCapitalize="characters"
          />
        ) : null}

        {method === 'import-secret' ? (
          <Field
            label="Stellar secret"
            value={secret}
            onChangeText={setSecret}
            placeholder="S..."
            secureTextEntry
            autoCapitalize="characters"
          />
        ) : null}

        {method === 'import-mnemonic' ? (
          <Field
            label="Recovery phrase"
            value={mnemonic}
            onChangeText={setMnemonic}
            placeholder="Enter words in order"
            multiline
            autoCapitalize="none"
          />
        ) : null}

        {method !== 'watch-only' ? (
          <>
            <Field
              label="App passphrase"
              value={appPassphrase}
              onChangeText={setAppPassphrase}
              placeholder="At least 15 characters"
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
            />
            <Field
              label="Confirm app passphrase"
              value={confirmPassphrase}
              onChangeText={setConfirmPassphrase}
              placeholder="Enter it again"
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
            />
            <PassphraseRequirements
              unicodeScalarCount={passphraseAssessment.unicodeScalarCount}
              meetsMinimum={passphraseAssessment.meetsMinimum}
              confirmationMatches={passphraseConfirmationMatches}
            />
            <View style={styles.infoBox}>
              <Text style={styles.infoGlyph}>i</Text>
              <Text style={styles.infoText}>
                This passphrase protects local signing material. It is not stored in Realm.
              </Text>
            </View>
          </>
        ) : null}

        {error ? <ErrorText message={error} /> : null}
      </View>
      <View style={styles.footer}>
        <PrimaryButton
          label={submitLabel(method)}
          onPress={() => void submit()}
          disabled={busy || (method !== 'watch-only' && !passphraseReady)}
        />
        {busy ? <ActivityIndicator color={theme.colors.actionPrimary} style={styles.busy} /> : null}
      </View>
    </FlowShell>
  );
}

function FlowShell({
  title,
  onBack,
  children,
}: React.PropsWithChildren<Readonly<{ title: string; onBack?: () => void }>>) {
  const styles = useThemedStyles(createStyles);

  return (
    <Screen scrollable={false} contentInset="none">
      <View style={styles.flowHeader}>
        <View style={styles.headerSide}>
          {onBack ? (
            <Pressable
              accessibilityRole="button"
              onPress={onBack}
              style={({ pressed }) => [styles.backButton, pressed ? styles.pressed : undefined]}
            >
              <Text style={styles.backGlyph}>‹</Text>
            </Pressable>
          ) : null}
        </View>
        <Text numberOfLines={1} style={styles.flowTitle}>
          {title}
        </Text>
        <View style={styles.headerSide} />
      </View>
      <ScrollView
        contentContainerStyle={styles.flowScroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </Screen>
  );
}

function Field(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  const theme = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { label, multiline, ...inputProps } = props;
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...inputProps}
        multiline={multiline}
        placeholderTextColor={theme.colors.textTertiary}
        selectionColor={theme.colors.actionPrimary}
        style={[styles.input, multiline ? styles.multiline : undefined]}
      />
    </View>
  );
}

function PassphraseRequirements({
  unicodeScalarCount,
  meetsMinimum,
  confirmationMatches,
}: Readonly<{
  unicodeScalarCount: number;
  meetsMinimum: boolean;
  confirmationMatches: boolean;
}>) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.passphraseGuide}>
      <Text style={styles.passphraseGuideTitle}>Use an app passphrase, not a PIN</Text>
      <Text style={styles.passphraseGuideText}>
        Use a long multi-word phrase or a password-manager generated password. Fresnica does not require forced
        uppercase/lowercase/digit/symbol mixtures.
      </Text>
      <View style={styles.requirementRow}>
        <Text style={meetsMinimum ? styles.requirementMet : styles.requirementPending}>
          {meetsMinimum ? '✓' : '○'}
        </Text>
        <Text style={styles.requirementText}>
          {unicodeScalarCount}/{NEW_PROTECTION_PASSPHRASE_MIN_UNICODE_SCALARS} characters minimum
        </Text>
      </View>
      <View style={styles.requirementRow}>
        <Text style={confirmationMatches ? styles.requirementMet : styles.requirementPending}>
          {confirmationMatches ? '✓' : '○'}
        </Text>
        <Text style={styles.requirementText}>Confirmation matches</Text>
      </View>
      <Text style={styles.passphrasePolicyText}>
        Routine signing can use system authentication after it is enabled. Keep this passphrase for exports, recovery,
        credential changes, and other high-risk maintenance.
      </Text>
    </View>
  );
}

function ChoiceButton(props: {
  glyph: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  primary?: boolean;
}) {
  const styles = useThemedStyles(createStyles);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.choice,
        props.primary ? styles.choicePrimary : undefined,
        pressed ? styles.pressed : undefined,
      ]}
    >
      <View style={[styles.choiceIcon, props.primary ? styles.choiceIconPrimary : undefined]}>
        <Text style={[styles.choiceGlyph, props.primary ? styles.choiceGlyphPrimary : undefined]}>{props.glyph}</Text>
      </View>
      <View style={styles.choiceText}>
        <Text style={[styles.choiceTitle, props.primary ? styles.choiceTitlePrimary : undefined]}>{props.title}</Text>
        <Text style={[styles.choiceSubtitle, props.primary ? styles.choiceSubtitlePrimary : undefined]}>
          {props.subtitle}
        </Text>
      </View>
      <Text style={[styles.choiceChevron, props.primary ? styles.choiceChevronPrimary : undefined]}>›</Text>
    </Pressable>
  );
}

function PrimaryButton(props: { label: string; onPress: () => void; disabled?: boolean }) {
  const styles = useThemedStyles(createStyles);

  return (
    <Pressable
      accessibilityRole="button"
      disabled={props.disabled}
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        props.disabled ? styles.disabled : undefined,
        pressed ? styles.primaryButtonPressed : undefined,
      ]}
    >
      <Text style={styles.primaryButtonText}>{props.label}</Text>
    </Pressable>
  );
}

function RecoveryPhrase({ mnemonic }: Readonly<{ mnemonic: string }>) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.recoveryBox}>
      {mnemonic
        .trim()
        .split(/\s+/u)
        .map((word, index) => (
          <View key={`${index}-${word}`} style={styles.recoveryWord}>
            <Text style={styles.recoveryNumber}>{index + 1}</Text>
            <Text selectable style={styles.recoveryText}>
              {word}
            </Text>
          </View>
        ))}
    </View>
  );
}

function ErrorText({ message }: Readonly<{ message: string }>) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.errorBox}>
      <Text style={styles.error}>{message}</Text>
    </View>
  );
}

function methodTitle(method: OnboardingMethod): string {
  switch (method) {
    case 'generate-mnemonic':
      return 'Create new wallet';
    case 'import-mnemonic':
      return 'Import recovery phrase';
    case 'import-secret':
      return 'Import Stellar secret';
    case 'watch-only':
      return 'Watch-only account';
  }
}

function methodDescription(method: OnboardingMethod): string {
  switch (method) {
    case 'generate-mnemonic':
      return 'Create a new Stellar signer and protect it locally with your Fresnica app passphrase.';
    case 'import-mnemonic':
      return 'Enter your recovery words exactly as they were backed up.';
    case 'import-secret':
      return 'Import an existing Stellar secret and protect it locally.';
    case 'watch-only':
      return 'Add a Stellar address for monitoring without storing signing material.';
  }
}

function submitLabel(method: OnboardingMethod): string {
  return method === 'watch-only' ? 'Add account' : 'Continue';
}

function readableError(error: unknown): string {
  return projectFeatureError(error, {fallbackMessage: 'Unable to continue.'}).message;
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.colors.background },
    brandHeader: {
      height: 62,
      paddingHorizontal: 20,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    brand: {
      color: theme.colors.textPrimary,
      fontSize: 25,
      lineHeight: 30,
      fontWeight: '800',
      letterSpacing: -0.7,
    },
    cancelButton: { paddingHorizontal: 4, paddingVertical: 8 },
    cancelText: { color: theme.colors.textSecondary, fontSize: 14, fontWeight: '700' },
    methodScreen: { flexGrow: 1, paddingBottom: 24 },
    introPanel: {
      minHeight: 235,
      overflow: 'hidden',
      justifyContent: 'flex-end',
      marginHorizontal: 16,
      borderRadius: 14,
      backgroundColor: theme.colors.surfaceStrong,
      padding: 22,
    },
    decorCircleLarge: {
      position: 'absolute',
      width: 220,
      height: 220,
      borderRadius: 110,
      right: -70,
      top: -75,
      borderWidth: 38,
      borderColor: theme.colors.actionPrimaryOutline,
    },
    decorCircleSmall: {
      position: 'absolute',
      width: 105,
      height: 105,
      borderRadius: 53,
      left: -22,
      top: 26,
      backgroundColor: theme.colors.actionPrimaryDecoration,
    },
    introEyebrow: {
      color: theme.colors.actionPrimary,
      fontSize: 11,
      lineHeight: 14,
      fontWeight: '800',
      letterSpacing: 1,
    },
    introTitle: {
      color: theme.colors.onSurfaceStrong,
      fontSize: 30,
      lineHeight: 36,
      fontWeight: '800',
      letterSpacing: -0.6,
      marginTop: 8,
    },
    introBody: { color: theme.colors.onSurfaceStrongMuted, fontSize: 15, lineHeight: 22, marginTop: 8, maxWidth: 320 },
    methodSection: { paddingHorizontal: 16, paddingTop: 16, gap: 10 },
    choice: {
      minHeight: 70,
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 11,
      backgroundColor: theme.colors.surfaceMuted,
      paddingHorizontal: 13,
      paddingVertical: 10,
    },
    choicePrimary: { backgroundColor: theme.colors.actionPrimary },
    choiceIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
      marginRight: 12,
    },
    choiceIconPrimary: { backgroundColor: theme.colors.onActionPrimarySubtle },
    choiceGlyph: { color: theme.colors.secondary, fontSize: 20, lineHeight: 23, fontWeight: '800' },
    choiceGlyphPrimary: { color: theme.colors.onActionPrimary },
    choiceText: { flex: 1, paddingRight: 8 },
    choiceTitle: { color: theme.colors.textPrimary, fontSize: 15, lineHeight: 19, fontWeight: '800' },
    choiceTitlePrimary: { color: theme.colors.onActionPrimary },
    choiceSubtitle: { color: theme.colors.textSecondary, fontSize: 11, lineHeight: 15, marginTop: 3 },
    choiceSubtitlePrimary: { color: theme.colors.onActionPrimaryMuted },
    choiceChevron: { color: theme.colors.textTertiary, fontSize: 25, lineHeight: 28 },
    choiceChevronPrimary: { color: theme.colors.onActionPrimary },
    flowHeader: {
      minHeight: 58,
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
      paddingHorizontal: 10,
    },
    headerSide: { width: 46, alignItems: 'center' },
    backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    backGlyph: { color: theme.colors.secondary, fontSize: 35, lineHeight: 38, fontWeight: '300', marginTop: -3 },
    flowTitle: {
      flex: 1,
      textAlign: 'center',
      color: theme.colors.textPrimary,
      fontSize: 16,
      lineHeight: 21,
      fontWeight: '800',
    },
    flowScroll: { flexGrow: 1, paddingBottom: 24 },
    formContent: { padding: 20, gap: 17 },
    formIntro: { color: theme.colors.textSecondary, fontSize: 14, lineHeight: 21, marginBottom: 2 },
    field: { gap: 7 },
    label: { color: theme.colors.textPrimary, fontSize: 13, lineHeight: 17, fontWeight: '700' },
    input: {
      minHeight: 48,
      borderRadius: 10,
      backgroundColor: theme.colors.surfaceMuted,
      paddingHorizontal: 14,
      paddingVertical: 11,
      color: theme.colors.textPrimary,
      fontSize: 15,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    multiline: { minHeight: 116, textAlignVertical: 'top' },
    passphraseGuide: {
      borderRadius: 10,
      backgroundColor: theme.colors.surfaceMuted,
      padding: 12,
      gap: 7,
    },
    passphraseGuideTitle: {
      color: theme.colors.textPrimary,
      fontSize: 13,
      lineHeight: 17,
      fontWeight: '800',
    },
    passphraseGuideText: {color: theme.colors.textSecondary, fontSize: 11, lineHeight: 17},
    requirementRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
    requirementMet: {color: theme.colors.positive, fontSize: 14, lineHeight: 18, fontWeight: '800'},
    requirementPending: {color: theme.colors.textTertiary, fontSize: 14, lineHeight: 18, fontWeight: '800'},
    requirementText: {flex: 1, color: theme.colors.textSecondary, fontSize: 11, lineHeight: 16},
    passphrasePolicyText: {
      color: theme.colors.textSecondary,
      fontSize: 10,
      lineHeight: 15,
      marginTop: 2,
    },
    infoBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: 10,
      padding: 12,
    },
    infoGlyph: {
      width: 20,
      height: 20,
      borderRadius: 10,
      textAlign: 'center',
      backgroundColor: theme.colors.surfaceStrong,
      color: theme.colors.onSurfaceStrong,
      fontSize: 12,
      lineHeight: 20,
      fontWeight: '800',
    },
    infoText: { flex: 1, color: theme.colors.textSecondary, fontSize: 12, lineHeight: 18 },
    footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 6 },
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
    busy: { marginTop: 10 },
    backupHero: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 34, paddingBottom: 22 },
    shieldMark: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.actionPrimaryDecoration,
      marginBottom: 18,
    },
    shieldGlyph: { color: theme.colors.actionPrimaryPressed, fontSize: 30, lineHeight: 34, fontWeight: '800' },
    heroTitle: {
      color: theme.colors.textPrimary,
      fontSize: 24,
      lineHeight: 30,
      fontWeight: '800',
      textAlign: 'center',
    },
    heroBody: { color: theme.colors.textSecondary, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 8 },
    recoveryBox: {
      marginHorizontal: 20,
      borderRadius: 12,
      backgroundColor: theme.colors.surfaceMuted,
      padding: 12,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    recoveryWord: {
      width: '47%',
      minHeight: 38,
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 8,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 9,
    },
    recoveryNumber: { width: 22, color: theme.colors.textTertiary, fontSize: 11, lineHeight: 15 },
    recoveryText: { flex: 1, color: theme.colors.textPrimary, fontSize: 14, lineHeight: 19, fontWeight: '700' },
    errorBox: {
      marginHorizontal: 20,
      marginTop: 14,
      borderRadius: 9,
      backgroundColor: theme.colors.negativeMuted,
      padding: 11,
    },
    error: { color: theme.colors.negativeStrong, fontSize: 12, lineHeight: 18, fontWeight: '600' },
    pressed: { opacity: 0.68 },
  });
}
