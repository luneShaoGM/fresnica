import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { TextInput, type StyleProp, type TextStyle } from 'react-native';

// The native secure field is uncontrolled. Only a Boolean availability signal
// escapes this boundary into React state; no password is a render prop or state.
export function createTransientPassphraseBuffer() {
  let text = '';
  return {
    replace(next: string) {
      text = next;
    },
    hasValue() {
      return text.length > 0;
    },
    consume(): string | undefined {
      const current = text;
      text = '';
      return current || undefined;
    },
    clear() {
      text = '';
    },
  };
}

export type PassphraseInputHandle = Readonly<{
  consume: () => string | undefined;
  clear: () => void;
}>;

type Props = Readonly<{
  label: string;
  hint: string;
  disabled: boolean;
  autoFocus?: boolean;
  style: StyleProp<TextStyle>;
  onPresenceChange: (present: boolean) => void;
}>;

export const PassphraseInput = forwardRef<PassphraseInputHandle, Props>(function SecurePassphraseField(
  { label, hint, disabled, autoFocus, style, onPresenceChange },
  ref,
) {
  const nativeInput = useRef<React.ElementRef<typeof TextInput>>(null);
  const buffer = useRef(createTransientPassphraseBuffer());

  const clear = useCallback(() => {
    buffer.current.clear();
    nativeInput.current?.clear();
    onPresenceChange(false);
  }, [onPresenceChange]);

  useImperativeHandle(
    ref,
    () => ({
      consume() {
        // Never retain the plaintext in a React state setter or controlled
        // TextInput value. The SDK's signWithPassphrase port must receive the
        // temporary value, but this field is cleared *before* that async call.
        const value = buffer.current.consume();
        nativeInput.current?.clear();
        onPresenceChange(false);
        return value;
      },
      clear,
    }),
    [clear, onPresenceChange],
  );

  useEffect(
    () => () => {
      // Unmount/focus loss/cancel destroys the local buffer even if the user
      // never pressed the confirm slide. No React state update on unmount.
      buffer.current.clear();
      nativeInput.current?.clear();
    },
    [],
  );

  return (
    <TextInput
      ref={nativeInput}
      accessibilityLabel={label}
      accessibilityHint={hint}
      autoFocus={autoFocus}
      autoCapitalize="none"
      autoCorrect={false}
      autoComplete="off"
      importantForAutofill="no"
      textContentType="none"
      editable={!disabled}
      secureTextEntry
      defaultValue=""
      onChangeText={value => {
        buffer.current.replace(value);
        onPresenceChange(buffer.current.hasValue());
      }}
      style={style}
    />
  );
});
