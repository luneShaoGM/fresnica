import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useLocalization } from '../../locale';
import { useAppTheme, useThemedStyles, type AppTheme } from '../../ui/theme';
import {
  beginMnemonicBackupVerification,
  evaluateMnemonicBackupVerification,
  MNEMONIC_BACKUP_PRESENTATION,
  returnToMnemonicBackupPresentation,
  updateMnemonicBackupAnswer,
  type MnemonicBackupVerificationState,
} from './mnemonicBackupVerificationState';

type Props = Readonly<{
  mnemonic: string;
  disabled?: boolean;
  onVerified: () => void | Promise<void>;
}>;

export function MnemonicBackupVerification({ mnemonic, disabled = false, onVerified }: Props) {
  const theme = useAppTheme();
  const { t } = useLocalization();
  const styles = useThemedStyles(createStyles);
  const [state, setState] = useState<MnemonicBackupVerificationState>(MNEMONIC_BACKUP_PRESENTATION);
  const [completing, setCompleting] = useState(false);
  const blocked = disabled || completing;

  function beginVerification() {
    if (blocked) return;
    setState(beginMnemonicBackupVerification(mnemonic));
  }

  function showPhraseAgain() {
    if (blocked) return;
    setState(returnToMnemonicBackupPresentation());
  }

  function changeAnswer(answerIndex: number, value: string) {
    setState(current => updateMnemonicBackupAnswer(current, answerIndex, value));
  }

  async function submitVerification() {
    if (blocked) return;

    const evaluation = evaluateMnemonicBackupVerification(mnemonic, state);
    setState(evaluation.state);
    if (!evaluation.verified) return;

    setCompleting(true);
    try {
      await onVerified();
    } finally {
      setCompleting(false);
    }
  }

  if (state.kind === 'phrase') {
    return (
      <View style={styles.container}>
        <RecoveryPhrase mnemonic={mnemonic} />
        <View style={styles.actionBlock}>
          <Text style={styles.guidance}>{t('backup.verify.presentationHint')}</Text>
          <PrimaryAction disabled={blocked} label={t('backup.verify.start')} onPress={beginVerification} />
        </View>
      </View>
    );
  }

  const answersReady = state.answers.every(answer => answer.trim().length > 0);

  return (
    <View style={styles.container}>
      <View style={styles.challengeHeader}>
        <Text style={styles.challengeTitle}>{t('backup.verify.title')}</Text>
        <Text style={styles.challengeBody}>{t('backup.verify.body')}</Text>
      </View>
      <View style={styles.challengeFields}>
        {state.positions.map((position, answerIndex) => (
          <View key={position} style={styles.field}>
            <Text style={styles.fieldLabel}>{t('backup.verify.wordLabel', { position: position + 1 })}</Text>
            <TextInput
              accessibilityLabel={t('backup.verify.wordAccessibilityLabel', {
                position: position + 1,
              })}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!blocked}
              onChangeText={value => changeAnswer(answerIndex, value)}
              placeholder={t('backup.verify.wordPlaceholder')}
              placeholderTextColor={theme.colors.textTertiary}
              selectionColor={theme.colors.actionPrimary}
              spellCheck={false}
              style={styles.input}
              value={state.answers[answerIndex] ?? ''}
            />
          </View>
        ))}
      </View>

      {state.mismatch ? (
        <Text accessibilityLiveRegion="assertive" accessibilityRole="alert" style={styles.mismatch}>
          {t('backup.verify.mismatch')}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          disabled={blocked}
          onPress={showPhraseAgain}
          style={({ pressed }) => [
            styles.secondaryButton,
            blocked ? styles.disabled : undefined,
            pressed ? styles.pressed : undefined,
          ]}
        >
          <Text style={styles.secondaryText}>{t('backup.verify.showPhrase')}</Text>
        </Pressable>
        <PrimaryAction
          busy={completing}
          disabled={blocked || !answersReady}
          label={t('backup.verify.submit')}
          onPress={submitVerification}
        />
      </View>
    </View>
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
          <View key={index} style={styles.recoveryWord}>
            <Text style={styles.recoveryNumber}>{index + 1}</Text>
            <Text selectable style={styles.recoveryText}>
              {word}
            </Text>
          </View>
        ))}
    </View>
  );
}

function PrimaryAction({
  label,
  onPress,
  disabled,
  busy = false,
}: Readonly<{
  label: string;
  onPress: () => void;
  disabled: boolean;
  busy?: boolean;
}>) {
  const theme = useAppTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        disabled || busy ? styles.disabled : undefined,
        pressed ? styles.pressed : undefined,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={theme.colors.onActionPrimary} />
      ) : (
        <Text style={styles.primaryText}>{label}</Text>
      )}
    </Pressable>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: { gap: 16 },
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
    recoveryNumber: {
      width: 22,
      color: theme.colors.textTertiary,
      fontSize: 11,
      lineHeight: 15,
    },
    recoveryText: {
      flex: 1,
      color: theme.colors.textPrimary,
      fontSize: 14,
      lineHeight: 19,
      fontWeight: '700',
    },
    actionBlock: { marginHorizontal: 20, gap: 12 },
    guidance: {
      color: theme.colors.textSecondary,
      fontSize: 12,
      lineHeight: 18,
      textAlign: 'center',
    },
    challengeHeader: { marginHorizontal: 20, gap: 7 },
    challengeTitle: {
      color: theme.colors.textPrimary,
      fontSize: 18,
      lineHeight: 23,
      fontWeight: '800',
      textAlign: 'center',
    },
    challengeBody: {
      color: theme.colors.textSecondary,
      fontSize: 12,
      lineHeight: 18,
      textAlign: 'center',
    },
    challengeFields: { marginHorizontal: 20, gap: 12 },
    field: { gap: 6 },
    fieldLabel: {
      color: theme.colors.textPrimary,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '700',
    },
    input: {
      minHeight: 48,
      borderRadius: 9,
      backgroundColor: theme.colors.surfaceMuted,
      color: theme.colors.textPrimary,
      paddingHorizontal: 13,
      fontSize: 15,
    },
    mismatch: {
      marginHorizontal: 20,
      borderRadius: 9,
      padding: 11,
      backgroundColor: theme.colors.negativeMuted,
      color: theme.colors.negativeStrong,
      fontSize: 12,
      lineHeight: 18,
      fontWeight: '600',
    },
    actions: { marginHorizontal: 20, gap: 10, paddingBottom: 8 },
    primaryButton: {
      minHeight: 50,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.actionPrimary,
      paddingHorizontal: 18,
    },
    primaryText: {
      color: theme.colors.onActionPrimary,
      fontSize: 15,
      lineHeight: 20,
      fontWeight: '800',
    },
    secondaryButton: {
      minHeight: 46,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    secondaryText: {
      color: theme.colors.textSecondary,
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '700',
    },
    disabled: { opacity: 0.45 },
    pressed: { opacity: 0.68 },
  });
}
