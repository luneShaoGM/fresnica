import React, { useEffect, useRef } from 'react';
import { AppState, KeyboardAvoidingView, Platform, Text } from 'react-native';
import { AppModal } from '../AppModal';
import { Button } from '../Button';
import { PassphraseInput, type PassphraseInputHandle } from '../PassphraseInput';
import { useThemedStyles } from '../../theme';
import { createStyles } from './styles';

export function PassphrasePrompt({
  visible,
  active = true,
  busy,
  title,
  label,
  hint,
  confirmLabel,
  cancelLabel,
  inputRef,
  hasValue,
  error,
  expiresAtUnixMs,
  onPresenceChange,
  onConfirm,
  onCancel,
  onExpire,
}: Readonly<{
  visible: boolean;
  active?: boolean;
  busy: boolean;
  title: string;
  label: string;
  hint: string;
  confirmLabel: string;
  cancelLabel: string;
  inputRef: React.RefObject<PassphraseInputHandle | null>;
  hasValue: boolean;
  error?: string;
  expiresAtUnixMs?: number;
  onPresenceChange(value: boolean): void;
  onConfirm(): void;
  onCancel(): void;
  onExpire(): void;
}>) {
  const styles = useThemedStyles(createStyles);
  const cancel = useRef(onCancel);
  cancel.current = onCancel;
  const expire = useRef(onExpire);
  expire.current = onExpire;
  useEffect(() => {
    if (!visible) return;
    const field = inputRef.current;
    const close = () => {
      inputRef.current?.clear();
      cancel.current();
    };
    if (!active || (AppState.currentState != null && AppState.currentState !== 'active')) {
      close();
      return;
    }
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') close();
    });
    const timer =
      expiresAtUnixMs === undefined
        ? undefined
        : setTimeout(
            () => {
              inputRef.current?.clear();
              expire.current();
            },
            Math.max(0, expiresAtUnixMs - Date.now()),
          );
    return () => {
      subscription.remove();
      clearTimeout(timer);
      field?.clear();
    };
  }, [active, visible, inputRef, expiresAtUnixMs]);
  if (!visible || !active) return null;
  return (
    <AppModal
      visible
      title={title}
      closeLabel={cancelLabel}
      onRequestClose={() => {
        if (!busy) onCancel();
      }}
    >
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.content}>
        <PassphraseInput
          ref={inputRef}
          autoFocus
          label={label}
          hint={hint}
          disabled={busy}
          onPresenceChange={onPresenceChange}
          style={styles.input}
        />
        {error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        ) : null}
        <Button label={confirmLabel} disabled={busy || !hasValue} onPress={onConfirm} />
        <Button label={cancelLabel} disabled={busy} variant="secondary" onPress={onCancel} />
      </KeyboardAvoidingView>
    </AppModal>
  );
}
