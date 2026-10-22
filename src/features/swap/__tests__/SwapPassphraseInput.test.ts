import React from 'react';
import { TextInput } from 'react-native';
import { createTransientPassphraseBuffer, type SwapPassphraseInputHandle } from '../SwapPassphraseInput';

describe('Swap passphrase ephemeral input boundary', () => {
  it('only hands the secret off once, clearing the input buffer synchronously', () => {
    const buffer = createTransientPassphraseBuffer();
    expect(buffer.hasValue()).toBe(false);
    buffer.replace('a private app passphrase');
    expect(buffer.hasValue()).toBe(true);
    expect(buffer.consume()).toBe('a private app passphrase');
    expect(buffer.hasValue()).toBe(false);
    expect(buffer.consume()).toBeUndefined();
  });

  it('cancellation, going back and clearing input discard the previous secret', () => {
    const buffer = createTransientPassphraseBuffer();
    buffer.replace('first sensitive string');
    buffer.clear();
    expect(buffer.consume()).toBeUndefined();
    buffer.replace('second sensitive string');
    buffer.replace('');
    expect(buffer.consume()).toBeUndefined();
    buffer.replace('third sensitive string');
    expect(buffer.consume()).toBe('third sensitive string');
    expect(buffer.consume()).toBeUndefined();
  });

  it('never copies the complete input into a React state transition', () => {
    const buffer = createTransientPassphraseBuffer();
    const publicSnapshot = () => ({ hasPassphrase: buffer.hasValue() });
    buffer.replace('long-private-passphrase');
    expect(publicSnapshot()).toEqual({ hasPassphrase: true });
    expect(JSON.stringify(publicSnapshot())).not.toContain('long-private-passphrase');
    buffer.clear();
    expect(publicSnapshot()).toEqual({ hasPassphrase: false });
  });
});

describe('uncontrolled secure native input lifecycle', () => {
  afterEach(() => jest.restoreAllMocks());

  it('never publishes plaintext to React state, clears the native text before handoff and on unmount', () => {
    const clearedNative = jest.fn();
    const nativeInput = { current: { clear: clearedNative } };
    const handle: { current: SwapPassphraseInputHandle | null } = { current: null };
    const presenceChanged = jest.fn();
    let cleanup: (() => void) | undefined;

    jest.isolateModules(() => {
      const react = jest.requireActual<typeof import('react')>('react');
      jest
        .spyOn(react, 'useRef')
        .mockImplementation(((initial: unknown) =>
          initial === null ? nativeInput : { current: initial }) as typeof react.useRef);
      jest
        .spyOn(react, 'useCallback')
        .mockImplementation(((callback: unknown) => callback) as typeof react.useCallback);
      jest.spyOn(react, 'useEffect').mockImplementation(((setup: () => void | (() => void)) => {
        cleanup = setup() || undefined;
      }) as typeof react.useEffect);
      jest.spyOn(react, 'useImperativeHandle').mockImplementation(((
        ref: React.Ref<SwapPassphraseInputHandle>,
        create: () => SwapPassphraseInputHandle,
      ) => {
        if (ref && typeof ref !== 'function') ref.current = create();
      }) as typeof react.useImperativeHandle);

      const { SwapPassphraseInput: IsolatedInput } =
        require('../SwapPassphraseInput') as typeof import('../SwapPassphraseInput');
      const render = IsolatedInput as unknown as {
        render: (
          props: React.ComponentProps<typeof IsolatedInput>,
          ref: React.Ref<SwapPassphraseInputHandle>,
        ) => React.ReactElement<React.ComponentProps<typeof TextInput>>;
      };
      const element = render.render(
        {
          label: 'App password',
          hint: 'Signing only',
          disabled: false,
          onPresenceChange: presenceChanged,
          style: {},
        },
        handle,
      );

      expect(element.type).toBe(TextInput);
      expect(element.props.value).toBeUndefined();
      expect(element.props.defaultValue).toBe('');
      expect(element.props.secureTextEntry).toBe(true);
      expect(element.props.autoComplete).toBe('off');
      element.props.onChangeText?.('do not store in React state');
      expect(presenceChanged).toHaveBeenLastCalledWith(true);
      expect(handle.current?.consume()).toBe('do not store in React state');
      expect(clearedNative).toHaveBeenCalledTimes(1);
      expect(presenceChanged).toHaveBeenLastCalledWith(false);
      expect(handle.current?.consume()).toBeUndefined();
      element.props.onChangeText?.('user cancelled');
      cleanup?.();
      expect(clearedNative).toHaveBeenCalledTimes(3);
      expect(handle.current?.consume()).toBeUndefined();
      expect(clearedNative).toHaveBeenCalledTimes(4);
    });
  });
});
