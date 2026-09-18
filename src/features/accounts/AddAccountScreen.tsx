import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  NEW_PROTECTION_PASSPHRASE_MIN_UNICODE_SCALARS,
  assessNewProtectionPassphrase,
} from '@capabilities/application-security/newPassphrasePolicy';
import { requiresExistingAppPassphrase } from '@capabilities/application-security/verifyExistingAppPassphrase';
import { Screen } from '@ui/components';
import { useAppTheme, useThemedStyles, type AppTheme } from '@ui/theme';

import { useLocalization } from '../../locale';
import { projectFeatureError } from '../featureError';
import { MnemonicBackupVerification } from '../onboarding/MnemonicBackupVerification';
import { completeMnemonicBackup } from '../onboarding/onboardingBootstrap';
import {
  runWatchOnlyOnboarding,
  type OnboardingProvisioningDependencies,
} from '../onboarding/runOnboardingProvisioning';
import { createExistingWalletAccount, type ExistingWalletCreateResult } from './createExistingWalletAccount';
import {
  deriveExistingWalletAccount,
  listExistingWalletHdSourceCandidates,
  stellarHdPath,
} from './deriveExistingWalletAccount';
import { importExistingWalletAccount } from './importExistingWalletAccount';

type AddMode = 'create' | 'derive-hd' | 'import-mnemonic' | 'import-secret' | 'watch-only';

type Props = Readonly<{
  dependencies: OnboardingProvisioningDependencies;
  onCreatedAccountReady: (accountId: string) => void | Promise<void>;
  onAccountPersisted: () => void;
  onWatchOnlyComplete: () => void;
  onCancel: () => void;
}>;

export function AddAccountScreen({
  dependencies,
  onCreatedAccountReady,
  onAccountPersisted,
  onWatchOnlyComplete,
  onCancel,
}: Props) {
  const styles = useThemedStyles(createStyles);
  const { t } = useLocalization();
  const [mode, setMode] = useState<AddMode>();
  const [label, setLabel] = useState('');
  const [address, setAddress] = useState('');
  const [secret, setSecret] = useState('');
  const [mnemonic, setMnemonic] = useState('');
  const [mnemonicPassphrase, setMnemonicPassphrase] = useState('');
  const [mnemonicIndex, setMnemonicIndex] = useState('0');
  const [mnemonicLanguage, setMnemonicLanguage] = useState('');
  const [hdSourceSignerId, setHdSourceSignerId] = useState('');
  const [hdIndex, setHdIndex] = useState('1');
  const [appPassphrase, setAppPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [created, setCreated] = useState<ExistingWalletCreateResult>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const hdSourceCandidates = listExistingWalletHdSourceCandidates(dependencies);
  const requiresCurrentPassphrase = requiresExistingAppPassphrase(dependencies.repository);
  const passphraseAssessment = assessNewProtectionPassphrase(appPassphrase);
  const newPassphraseReady =
    passphraseAssessment.meetsMinimum && confirmPassphrase.length > 0 && confirmPassphrase === appPassphrase;

  function clearSensitiveInputs() {
    setSecret('');
    setMnemonic('');
    setMnemonicPassphrase('');
    setAppPassphrase('');
    setConfirmPassphrase('');
  }

  function resetImportMetadata() {
    setMnemonicIndex('0');
    setMnemonicLanguage('');
  }

  function resetHdMetadata() {
    setHdSourceSignerId('');
    setHdIndex('1');
  }

  function chooseMode(nextMode: AddMode) {
    clearSensitiveInputs();
    resetImportMetadata();
    resetHdMetadata();
    setAddress('');
    setError(undefined);
    setMode(nextMode);
  }

  function backToChoices() {
    if (busy) return;
    clearSensitiveInputs();
    resetImportMetadata();
    resetHdMetadata();
    setAddress('');
    setError(undefined);
    setMode(undefined);
  }

  async function submitCreate() {
    setBusy(true);
    setError(undefined);
    try {
      const result = await createExistingWalletAccount(dependencies, {
        appPassphrase,
        ...(requiresCurrentPassphrase ? {} : { confirmAppPassphrase: confirmPassphrase }),
        label,
      });
      clearSensitiveInputs();
      setCreated(result);
    } catch (caught) {
      setError(readableError(caught, t('accounts.add.error')));
    } finally {
      setBusy(false);
    }
  }

  async function submitImport() {
    if (mode !== 'import-mnemonic' && mode !== 'import-secret') return;
    setBusy(true);
    setError(undefined);
    try {
      const result =
        mode === 'import-secret'
          ? await importExistingWalletAccount(dependencies, {
              kind: 'secret',
              secret,
              appPassphrase,
              ...(requiresCurrentPassphrase ? {} : { confirmAppPassphrase: confirmPassphrase }),
              label,
            })
          : await importExistingWalletAccount(dependencies, {
              kind: 'mnemonic',
              mnemonic,
              mnemonicPassphrase,
              index: parseDerivationIndex(mnemonicIndex),
              ...(mnemonicLanguage.trim() ? { language: mnemonicLanguage.trim() } : {}),
              appPassphrase,
              ...(requiresCurrentPassphrase ? {} : { confirmAppPassphrase: confirmPassphrase }),
              label,
            });
      clearSensitiveInputs();
      onAccountPersisted();
      await onCreatedAccountReady(result.account.account.id);
    } catch (caught) {
      setError(readableImportError(caught, t));
    } finally {
      setBusy(false);
    }
  }

  async function submitHdDerive() {
    if (mode !== 'derive-hd') return;
    setBusy(true);
    setError(undefined);
    try {
      const result = await deriveExistingWalletAccount(dependencies, {
        sourceSignerId: hdSourceSignerId,
        index: parseHdDerivationIndex(hdIndex),
        appPassphrase,
        label,
      });
      clearSensitiveInputs();
      onAccountPersisted();
      await onCreatedAccountReady(result.account.account.id);
    } catch (caught) {
      setError(readableHdError(caught, t));
    } finally {
      setBusy(false);
    }
  }

  async function submitWatchOnly() {
    setBusy(true);
    setError(undefined);
    try {
      await runWatchOnlyOnboarding(dependencies, { address, label });
      onWatchOnlyComplete();
    } catch (caught) {
      setError(readableError(caught, t('accounts.add.error')));
    } finally {
      setBusy(false);
    }
  }

  async function confirmCreatedBackup() {
    if (!created) return;
    setBusy(true);
    setError(undefined);
    try {
      await completeMnemonicBackup(dependencies, created.account.signer.id, () =>
        onCreatedAccountReady(created.account.account.id),
      );
      setCreated(undefined);
    } catch (caught) {
      setError(readableError(caught, t('accounts.add.defaultError')));
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return (
      <FlowShell title={t('accounts.add.backup.title')}>
        <View style={styles.backupHero}>
          <Text style={styles.heroTitle}>{t('accounts.add.backup.title')}</Text>
          <Text style={styles.description}>{t('accounts.add.backup.body')}</Text>
        </View>
        <MnemonicBackupVerification
          disabled={busy}
          mnemonic={created.backup.mnemonic}
          onVerified={confirmCreatedBackup}
        />
        {created.systemAuthRegistration === 'repair-required' ? (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>{t('accounts.add.systemAuthRepair')}</Text>
          </View>
        ) : null}
        {error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        ) : null}
      </FlowShell>
    );
  }

  if (!mode) {
    return (
      <Screen scrollable={false} contentInset="none">
        <Header title={t('accounts.add.title')} onBack={onCancel} disabled={busy} />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.intro}>{t('accounts.add.intro')}</Text>
          <ChoiceButton
            glyph="+"
            title={t('accounts.add.create.title')}
            subtitle={t('accounts.add.create.subtitle')}
            onPress={() => chooseMode('create')}
          />
          <ChoiceButton
            glyph="↘"
            title={t('accounts.add.importMnemonic.title')}
            subtitle={t('accounts.add.importMnemonic.subtitle')}
            onPress={() => chooseMode('import-mnemonic')}
          />
          <ChoiceButton
            glyph="K"
            title={t('accounts.add.importSecret.title')}
            subtitle={t('accounts.add.importSecret.subtitle')}
            onPress={() => chooseMode('import-secret')}
          />
          <ChoiceButton
            glyph="↳"
            title={t('accounts.add.deriveHd.title')}
            subtitle={
              hdSourceCandidates.length > 0
                ? t('accounts.add.deriveHd.subtitle')
                : t('accounts.add.deriveHd.unavailableSubtitle')
            }
            disabled={hdSourceCandidates.length === 0}
            onPress={() => chooseMode('derive-hd')}
          />
          <ChoiceButton
            glyph="◎"
            title={t('accounts.add.watchOnly.title')}
            subtitle={t('accounts.add.watchOnly.subtitle')}
            onPress={() => chooseMode('watch-only')}
          />
        </ScrollView>
      </Screen>
    );
  }

  if (mode === 'watch-only') {
    return (
      <FlowShell title={t('accounts.add.watchOnly.title')} onBack={backToChoices} backDisabled={busy}>
        <View style={styles.formContent}>
          <Field
            label={t('accounts.add.label')}
            value={label}
            onChangeText={setLabel}
            placeholder={t('accounts.add.labelPlaceholder')}
            editable={!busy}
          />
          <Field
            label={t('accounts.add.watchOnly.address')}
            value={address}
            onChangeText={setAddress}
            placeholder={t('accounts.add.watchOnly.addressPlaceholder')}
            editable={!busy}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          {error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          ) : null}
        </View>
        <View style={styles.footer}>
          <PrimaryButton
            disabled={busy || address.trim().length === 0}
            label={t('accounts.add.watchOnly.action')}
            busy={busy}
            onPress={submitWatchOnly}
          />
        </View>
      </FlowShell>
    );
  }

  const protectionReady = requiresCurrentPassphrase ? appPassphrase.length > 0 : newPassphraseReady;
  const isMnemonicImport = mode === 'import-mnemonic';
  const isSecretImport = mode === 'import-secret';
  const isHdDerive = mode === 'derive-hd';
  const hdPath = isHdDerive ? readHdPath(hdIndex) : undefined;
  const flowTitle = isMnemonicImport
    ? t('accounts.add.importMnemonic.title')
    : isSecretImport
      ? t('accounts.add.importSecret.title')
      : isHdDerive
        ? t('accounts.add.deriveHd.title')
        : t('accounts.add.create.title');
  const flowIntro = isMnemonicImport
    ? t('accounts.add.importMnemonic.intro')
    : isSecretImport
      ? t('accounts.add.importSecret.intro')
      : isHdDerive
        ? t('accounts.add.deriveHd.intro')
        : requiresCurrentPassphrase
          ? t('accounts.add.create.existingPassphraseIntro')
          : t('accounts.add.create.newPassphraseIntro');

  return (
    <FlowShell title={flowTitle} onBack={backToChoices} backDisabled={busy}>
      <View style={styles.formContent}>
        <Text style={styles.description}>{flowIntro}</Text>
        <Field
          label={t('accounts.add.label')}
          value={label}
          onChangeText={setLabel}
          placeholder={t('accounts.add.labelPlaceholder')}
          editable={!busy}
        />
        {isSecretImport ? (
          <Field
            label={t('accounts.add.import.secret')}
            value={secret}
            onChangeText={setSecret}
            placeholder={t('accounts.add.import.secretPlaceholder')}
            editable={!busy}
            secureTextEntry
            autoCapitalize="characters"
            autoCorrect={false}
          />
        ) : null}
        {isHdDerive ? (
          <>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{t('accounts.add.deriveHd.source')}</Text>
              <View style={styles.sourceList}>
                {hdSourceCandidates.map(candidate => (
                  <HdSourceButton
                    key={candidate.signerId}
                    candidate={candidate}
                    selected={candidate.signerId === hdSourceSignerId}
                    disabled={busy}
                    onPress={() => setHdSourceSignerId(candidate.signerId)}
                  />
                ))}
              </View>
            </View>
            <Field
              label={t('accounts.add.deriveHd.index')}
              value={hdIndex}
              onChangeText={setHdIndex}
              placeholder="1"
              editable={!busy}
              keyboardType="number-pad"
            />
            <View style={styles.pathBox}>
              <Text style={styles.pathLabel}>{t('accounts.add.deriveHd.path')}</Text>
              <Text accessibilityLabel={t('accounts.add.deriveHd.path')} selectable style={styles.pathValue}>
                {hdPath ?? t('accounts.add.deriveHd.invalidPath')}
              </Text>
            </View>
          </>
        ) : null}
        {isMnemonicImport ? (
          <>
            <Field
              label={t('accounts.add.import.mnemonic')}
              value={mnemonic}
              onChangeText={setMnemonic}
              placeholder={t('accounts.add.import.mnemonicPlaceholder')}
              editable={!busy}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Field
              label={t('accounts.add.import.mnemonicPassphrase')}
              value={mnemonicPassphrase}
              onChangeText={setMnemonicPassphrase}
              placeholder={t('accounts.add.import.mnemonicPassphrasePlaceholder')}
              editable={!busy}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Field
              label={t('accounts.add.import.mnemonicIndex')}
              value={mnemonicIndex}
              onChangeText={setMnemonicIndex}
              placeholder="0"
              editable={!busy}
              keyboardType="number-pad"
            />
            <Field
              label={t('accounts.add.import.mnemonicLanguage')}
              value={mnemonicLanguage}
              onChangeText={setMnemonicLanguage}
              placeholder={t('accounts.add.import.mnemonicLanguagePlaceholder')}
              editable={!busy}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </>
        ) : null}
        <Field
          label={requiresCurrentPassphrase ? t('accounts.add.currentPassphrase') : t('accounts.add.newPassphrase')}
          value={appPassphrase}
          onChangeText={setAppPassphrase}
          placeholder={
            requiresCurrentPassphrase
              ? t('accounts.add.currentPassphrasePlaceholder')
              : t('accounts.add.newPassphrasePlaceholder')
          }
          editable={!busy}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
        />
        {!requiresCurrentPassphrase ? (
          <>
            <Field
              label={t('accounts.add.confirmPassphrase')}
              value={confirmPassphrase}
              onChangeText={setConfirmPassphrase}
              placeholder={t('accounts.add.confirmPassphrasePlaceholder')}
              editable={!busy}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.passphraseHint}>
              {t('accounts.add.passphraseMinimum', {
                count: NEW_PROTECTION_PASSPHRASE_MIN_UNICODE_SCALARS,
              })}
            </Text>
          </>
        ) : null}
        {error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        ) : null}
      </View>
      <View style={styles.footer}>
        <PrimaryButton
          disabled={
            busy ||
            !protectionReady ||
            (isSecretImport && secret.trim().length === 0) ||
            (isMnemonicImport && mnemonic.trim().length === 0) ||
            (isHdDerive && (hdSourceSignerId.length === 0 || hdPath === undefined))
          }
          label={
            isMnemonicImport
              ? t('accounts.add.importMnemonic.action')
              : isSecretImport
                ? t('accounts.add.importSecret.action')
                : isHdDerive
                  ? t('accounts.add.deriveHd.action')
                  : t('accounts.add.create.action')
          }
          busy={busy}
          onPress={isMnemonicImport || isSecretImport ? submitImport : isHdDerive ? submitHdDerive : submitCreate}
        />
      </View>
    </FlowShell>
  );
}

function Header({
  title,
  onBack,
  disabled = false,
}: Readonly<{
  title: string;
  onBack: () => void;
  disabled?: boolean;
}>) {
  const styles = useThemedStyles(createStyles);
  const { t } = useLocalization();
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityLabel={t('common.back')}
        accessibilityRole="button"
        disabled={disabled}
        onPress={onBack}
        style={styles.backButton}
      >
        <Text style={styles.backGlyph}>‹</Text>
      </Pressable>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={styles.headerSpacer} />
    </View>
  );
}

function FlowShell({
  title,
  onBack,
  backDisabled = false,
  children,
}: React.PropsWithChildren<
  Readonly<{
    title: string;
    onBack?: () => void;
    backDisabled?: boolean;
  }>
>) {
  const styles = useThemedStyles(createStyles);
  return (
    <Screen scrollable={false} contentInset="none">
      {onBack ? (
        <Header title={title} onBack={onBack} disabled={backDisabled} />
      ) : (
        <View style={styles.header}>
          <View style={styles.headerSpacer} />
          <Text style={styles.headerTitle}>{title}</Text>
          <View style={styles.headerSpacer} />
        </View>
      )}
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

function ChoiceButton({
  glyph,
  title,
  subtitle,
  disabled = false,
  onPress,
}: Readonly<{
  glyph: string;
  title: string;
  subtitle: string;
  disabled?: boolean;
  onPress: () => void;
}>) {
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable
      accessibilityLabel={title}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choiceButton,
        disabled ? styles.disabled : undefined,
        pressed ? styles.pressed : undefined,
      ]}
    >
      <View style={styles.choiceGlyphBox}>
        <Text style={styles.choiceGlyph}>{glyph}</Text>
      </View>
      <View style={styles.flex}>
        <Text style={styles.choiceTitle}>{title}</Text>
        <Text style={styles.choiceSubtitle}>{subtitle}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

function HdSourceButton({
  candidate,
  selected,
  disabled,
  onPress,
}: Readonly<{
  candidate: ReturnType<typeof listExistingWalletHdSourceCandidates>[number];
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}>) {
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable
      accessibilityLabel={candidate.signerPublicKey}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.sourceButton,
        selected ? styles.sourceButtonSelected : undefined,
        pressed ? styles.pressed : undefined,
      ]}
    >
      <View style={styles.sourceRadio}>{selected ? <View style={styles.sourceRadioDot} /> : null}</View>
      <View style={styles.flex}>
        <Text style={styles.sourceLabel}>{candidate.accountLabel}</Text>
        <Text selectable style={styles.sourceKey}>
          {candidate.signerPublicKey}
        </Text>
      </View>
    </Pressable>
  );
}

function Field(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  const theme = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { label, ...inputProps } = props;
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...inputProps}
        accessibilityLabel={inputProps.accessibilityLabel ?? label}
        placeholderTextColor={theme.colors.textTertiary}
        selectionColor={theme.colors.actionPrimary}
        style={styles.input}
      />
    </View>
  );
}

function PrimaryButton({
  disabled,
  label,
  busy,
  onPress,
}: Readonly<{
  disabled: boolean;
  label: string;
  busy: boolean;
  onPress: () => void;
}>) {
  const theme = useAppTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        disabled ? styles.disabled : undefined,
        pressed ? styles.pressed : undefined,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={theme.colors.onActionPrimary} />
      ) : (
        <Text style={styles.primaryButtonText}>{label}</Text>
      )}
    </Pressable>
  );
}

function readableError(error: unknown, fallbackMessage: string): string {
  return projectFeatureError(error, { fallbackMessage }).message;
}

function readableHdError(error: unknown, t: ReturnType<typeof useLocalization>['t']): string {
  return projectFeatureError(error, {
    fallbackMessage: t('accounts.add.deriveHd.error'),
    messages: {
      'invalid-passcode': t('accounts.add.deriveHd.invalidPassphrase'),
      'invalid-passphrase': t('accounts.add.deriveHd.invalidPassphrase'),
      'protected-signer-envelope-missing': t('accounts.add.deriveHd.sourceUnavailable'),
      'hd-source-not-eligible': t('accounts.add.deriveHd.sourceUnavailable'),
      'account-already-exists': t('accounts.add.deriveHd.accountExists'),
      'account-not-selectable': t('accounts.add.deriveHd.accountHidden'),
      'invalid-derivation-index': t('accounts.add.deriveHd.invalidIndex'),
      'invalid-input': t('accounts.add.deriveHd.sourceUnavailable'),
      'default-account-persistence-failed': t('accounts.add.defaultError'),
    },
  }).message;
}

function readableImportError(error: unknown, t: ReturnType<typeof useLocalization>['t']): string {
  return projectFeatureError(error, {
    fallbackMessage: t('accounts.add.import.error'),
    messages: {
      'invalid-passcode': t('accounts.add.import.invalidPassphrase'),
      'invalid-passphrase': t('accounts.add.import.invalidPassphrase'),
      'app-passphrase-too-short': t('accounts.add.import.passphraseTooShort'),
      'app-passphrase-confirmation-mismatch': t('accounts.add.import.passphraseMismatch'),
      'protected-signer-envelope-missing': t('accounts.add.import.protectedSignerMissing'),
      'account-already-exists': t('accounts.add.import.accountExists'),
      'account-not-selectable': t('accounts.add.import.accountHidden'),
      'invalid-derivation-index': t('accounts.add.import.invalidIndex'),
      'invalid-input': t('accounts.add.import.invalidMaterial'),
      'default-account-persistence-failed': t('accounts.add.defaultError'),
    },
  }).message;
}

function parseDerivationIndex(value: string): number {
  const normalized = value.trim();
  if (!/^\d+$/u.test(normalized)) {
    throw new Error('invalid-derivation-index');
  }
  const index = Number(normalized);
  if (!Number.isSafeInteger(index) || index < 0) {
    throw new Error('invalid-derivation-index');
  }
  return index;
}

function parseHdDerivationIndex(value: string): number {
  const index = parseDerivationIndex(value);
  stellarHdPath(index);
  return index;
}

function readHdPath(value: string): string | undefined {
  try {
    return stellarHdPath(parseDerivationIndex(value));
  } catch {
    return undefined;
  }
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    flex: { flex: 1 },
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
    content: { paddingHorizontal: 18, paddingTop: 28, paddingBottom: 32, gap: 12 },
    intro: { color: theme.colors.textSecondary, fontSize: 14, lineHeight: 21, marginBottom: 8 },
    choiceButton: {
      minHeight: 78,
      borderRadius: 12,
      backgroundColor: theme.colors.surfaceMuted,
      paddingHorizontal: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    choiceGlyphBox: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surfaceStrong,
    },
    choiceGlyph: { color: theme.colors.actionPrimary, fontSize: 22, fontWeight: '800' },
    choiceTitle: { color: theme.colors.textPrimary, fontSize: 15, lineHeight: 20, fontWeight: '800' },
    choiceSubtitle: { color: theme.colors.textSecondary, fontSize: 11, lineHeight: 16, marginTop: 3 },
    chevron: { color: theme.colors.textTertiary, fontSize: 28, fontWeight: '300' },
    flowScroll: { flexGrow: 1, paddingBottom: 18 },
    formContent: { paddingHorizontal: 18, paddingTop: 22, gap: 14 },
    description: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 20 },
    field: { gap: 7 },
    fieldLabel: { color: theme.colors.textPrimary, fontSize: 12, lineHeight: 16, fontWeight: '700' },
    sourceList: { gap: 8 },
    sourceButton: {
      minHeight: 62,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    sourceButtonSelected: { borderColor: theme.colors.actionPrimary },
    sourceRadio: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 1,
      borderColor: theme.colors.textTertiary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sourceRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.actionPrimary },
    sourceLabel: { color: theme.colors.textPrimary, fontSize: 13, lineHeight: 18, fontWeight: '700' },
    sourceKey: { color: theme.colors.textSecondary, fontSize: 10, lineHeight: 15 },
    pathBox: { borderRadius: 10, backgroundColor: theme.colors.surfaceMuted, padding: 12, gap: 4 },
    pathLabel: { color: theme.colors.textSecondary, fontSize: 11, lineHeight: 15, fontWeight: '700' },
    pathValue: { color: theme.colors.textPrimary, fontSize: 14, lineHeight: 19, fontWeight: '700' },
    input: {
      minHeight: 50,
      borderRadius: 10,
      backgroundColor: theme.colors.surfaceMuted,
      paddingHorizontal: 13,
      color: theme.colors.textPrimary,
      fontSize: 14,
    },
    passphraseHint: { color: theme.colors.textTertiary, fontSize: 11, lineHeight: 17 },
    error: {
      marginHorizontal: 18,
      marginTop: 14,
      borderRadius: 9,
      padding: 12,
      backgroundColor: theme.colors.negativeMuted,
      color: theme.colors.negative,
      fontSize: 12,
      lineHeight: 18,
    },
    notice: {
      marginHorizontal: 18,
      marginTop: 14,
      borderRadius: 9,
      padding: 12,
      backgroundColor: theme.colors.surfaceMuted,
    },
    noticeText: { color: theme.colors.textSecondary, fontSize: 12, lineHeight: 18 },
    footer: {
      marginTop: 'auto',
      paddingHorizontal: 18,
      paddingTop: 12,
      paddingBottom: 10,
    },
    primaryButton: {
      minHeight: 52,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.actionPrimary,
    },
    primaryButtonText: { color: theme.colors.onActionPrimary, fontSize: 15, lineHeight: 20, fontWeight: '800' },
    disabled: { opacity: 0.45 },
    pressed: { opacity: 0.68 },
    backupHero: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 28, gap: 8 },
    heroTitle: {
      color: theme.colors.textPrimary,
      fontSize: 22,
      lineHeight: 28,
      fontWeight: '800',
      textAlign: 'center',
    },
  });
}
