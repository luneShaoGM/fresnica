import React, { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

import { useLocalization } from '../../locale';
import { useAppTheme, useThemedStyles } from '../../ui/theme';
import {
  beginMnemonicBackupVerification,
  evaluateMnemonicBackupVerification,
  MNEMONIC_BACKUP_PRESENTATION,
  returnToMnemonicBackupPresentation,
  updateMnemonicBackupAnswer,
  type MnemonicBackupVerificationState,
} from './mnemonicBackupVerificationState';
import { createStyles } from './styles';

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
              autoComplete="off"
              autoCorrect={false}
              editable={!blocked}
              importantForAutofill="no"
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
