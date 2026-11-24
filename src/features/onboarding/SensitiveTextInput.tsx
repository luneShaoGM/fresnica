import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { TextInput, type TextInputProps } from 'react-native';

export type SensitiveTextInputHandle = Readonly<{
  read: () => string;
  consume: () => string;
  clear: (notify?: boolean) => void;
}>;

export type SensitiveTextInputProps = Omit<TextInputProps, 'value' | 'defaultValue' | 'children' | 'onChangeText'> &
  Readonly<{ onTextChange?: (value: string) => void }>;

// S01 also needs visible/multiline inputs. Keep the same uncontrolled native
// input boundary as PassphraseInput without changing other signing consumers.
export const SensitiveTextInput = forwardRef<SensitiveTextInputHandle, SensitiveTextInputProps>(
  function SensitiveTextInput({ onTextChange, ...props }, ref) {
    const input = useRef<React.ElementRef<typeof TextInput>>(null);
    const text = useRef('');
    const live = useRef(true);

    useImperativeHandle(ref, () => {
      const clear = (notify = true) => {
        text.current = '';
        input.current?.clear();
        if (notify) onTextChange?.('');
      };
      return {
        // Only synchronous validation may inspect this local buffer.
        read: () => text.current,
        consume: () => {
          const value = text.current;
          clear();
          return value;
        },
        clear,
      };
    }, [onTextChange]);

    useEffect(() => {
      live.current = true;
      const nativeInput = input.current;
      return () => {
        live.current = false;
        text.current = '';
        nativeInput?.clear();
      };
    }, []);

    return (
      <TextInput
        {...props}
        ref={input}
        defaultValue=""
        autoComplete="off"
        importantForAutofill="no"
        textContentType="none"
        autoCorrect={false}
        spellCheck={false}
        onChangeText={value => {
          if (!live.current || props.editable === false) return;
          text.current = value;
          onTextChange?.(value);
        }}
      />
    );
  },
);
