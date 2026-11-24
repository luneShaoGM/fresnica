import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

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
import { SensitiveTextInput, type SensitiveTextInputHandle } from './SensitiveTextInput';

type Props = Readonly<{
  disabled?: boolean;
  onVerified: () => void | Promise<void>;
}>;

export type MnemonicBackupVerificationHandle = Readonly<{
  load: (mnemonic: string) => void;
  clear: (updateUi?: boolean) => void;
}>;

export const MnemonicBackupVerification = forwardRef<MnemonicBackupVerificationHandle, Props>(
function MnemonicBackupVerification({ disabled = false, onVerified }, ref) {
  const theme = useAppTheme();
  const { t } = useLocalization();
  const styles = useThemedStyles(createStyles);
  const phrase = useRef('');
  const outputs = useRef<Array<React.ElementRef<typeof TextInput> | null>>([]);
  const answers = useRef<Array<SensitiveTextInputHandle | null>>([]);
  const epoch = useRef(0);
  const completingNow = useRef(false);
  const live = useRef(true);
  const [revision, setRevision] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const [state, setState] = useState<MnemonicBackupVerificationState>(MNEMONIC_BACKUP_PRESENTATION);
  const [completing, setCompleting] = useState(false);
  const blocked = disabled || completing;

  const clearAnswers = useCallback(() => {
    answers.current.forEach(input => input?.clear(false));
  }, []);

  const clear = useCallback((updateUi = true) => {
    epoch.current += 1;
    phrase.current = '';
    outputs.current.forEach(input => input?.clear());
    clearAnswers();
    completingNow.current = false;
    if (updateUi && live.current) {
      setRevision(epoch.current);
      setWordCount(0);
      setState(MNEMONIC_BACKUP_PRESENTATION);
      setCompleting(false);
    }
  }, [clearAnswers]);

  useImperativeHandle(ref, () => ({
    load(mnemonic) {
      clear();
      if (!live.current || !mnemonic.trim()) return;
      phrase.current = mnemonic;
      setWordCount(mnemonic.trim().split(/\s+/u).length);
    },
    clear,
  }), [clear]);

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      clear(false);
    };
  }, [clear]);

  function beginVerification() {
    if (revision !== epoch.current || blocked || completingNow.current || !phrase.current) return;
    outputs.current.forEach(input => input?.clear());
    clearAnswers();
    setState(beginMnemonicBackupVerification(wordCount));
  }

  function showPhraseAgain() {
    if (revision !== epoch.current || blocked || completingNow.current || !phrase.current) return;
    clearAnswers();
    setState(returnToMnemonicBackupPresentation());
  }

  function changeAnswer(answerIndex: number, value: string) {
    if (revision !== epoch.current || completingNow.current) return;
    setState(current => updateMnemonicBackupAnswer(current, answerIndex, value.trim().length > 0));
  }

  async function submitVerification() {
    if (revision !== epoch.current || blocked || completingNow.current || !phrase.current) return;

    const evaluation = evaluateMnemonicBackupVerification(
      phrase.current,
      state,
      answers.current.map(input => input?.read() ?? ''),
    );
    setState(evaluation.state);
    if (!evaluation.verified) return;

    // A mismatch preserves the fields for correction. Success releases both
    // the answers and the full phrase before asynchronous completion begins.
    clearAnswers();
    phrase.current = '';
    outputs.current.forEach(input => input?.clear());
    setWordCount(0);
    setState(MNEMONIC_BACKUP_PRESENTATION);
    completingNow.current = true;
    const owner = epoch.current;
    setCompleting(true);
    try {
      await onVerified();
    } finally {
      if (live.current && epoch.current === owner) {
        completingNow.current = false;
        setCompleting(false);
      }
    }
  }

  if (state.kind === 'phrase') {
    return (
      <View style={styles.container}>
        <View style={styles.recoveryBox}>
          {Array.from({ length: wordCount }, (_, index) => (
            <View key={index} style={styles.recoveryWord}>
              <Text style={styles.recoveryNumber}>{index + 1}</Text>
              <TextInput
                ref={input => {
                  outputs.current[index]?.clear();
                  outputs.current[index] = input;
                  if (input && phrase.current) {
                    input.setNativeProps({ text: phrase.current.trim().split(/\s+/u)[index] ?? '' });
                  }
                }}
                accessibilityLabel={t('backup.verify.wordAccessibilityLabel', { position: index + 1 })}
                defaultValue=""
                editable={false}
                caretHidden
                showSoftInputOnFocus={false}
                autoComplete="off"
                importantForAutofill="no"
                textContentType="none"
                autoCorrect={false}
                selectionColor={theme.colors.actionPrimary}
                style={[styles.recoveryText, nativeStyles.word]}
              />
            </View>
          ))}
        </View>
        <View style={styles.actionBlock}>
          <Text style={styles.guidance}>{t('backup.verify.presentationHint')}</Text>
          <PrimaryAction disabled={blocked || wordCount === 0} label={t('backup.verify.start')} onPress={beginVerification} />
        </View>
      </View>
    );
  }

  const answersReady = state.answersPresent.every(Boolean);

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
            <SensitiveTextInput
              ref={input => { answers.current[answerIndex] = input; }}
              accessibilityLabel={t('backup.verify.wordAccessibilityLabel', {
                position: position + 1,
              })}
              autoCapitalize="none"
              autoComplete="off"
              autoCorrect={false}
              editable={!blocked}
              importantForAutofill="no"
              onTextChange={value => changeAnswer(answerIndex, value)}
              placeholder={t('backup.verify.wordPlaceholder')}
              placeholderTextColor={theme.colors.textTertiary}
              selectionColor={theme.colors.actionPrimary}
              spellCheck={false}
              style={styles.input}
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
});

const nativeStyles = StyleSheet.create({ word: { padding: 0 } });

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
