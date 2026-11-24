import React from 'react';
import { StyleSheet, Text, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { Button, themes, type ButtonProps } from '@fresnica/ui-native';

import { FeedbackContext as mockFeedbackContext } from '@ui/feedback';
import { defaultTheme } from '@ui/theme';
import { createAppearanceTheme } from '@ui/theme/appearanceTheme';
import { toNativeUiTheme } from '@ui/theme/toNativeUiTheme';
import { NativeButton } from '../NativeButton';

let mockTheme = toNativeUiTheme(createAppearanceTheme(false), themes.light);
let mockFeedback: (() => void) | undefined;
const mockLocale = { close: '关闭', loading: '正在加载' };
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useContext: (context: unknown) =>
    context === mockFeedbackContext ? mockFeedback : { theme: mockTheme, locale: mockLocale },
}));

type RenderedButtonProps = {
  children?: React.ReactNode;
  disabled?: boolean;
  accessibilityState?: { disabled: boolean; busy: boolean };
  onPress?: (...args: unknown[]) => unknown;
  style: (state: { pressed: boolean }) => StyleProp<ViewStyle>;
};
function renderLibraryButton(props: ButtonProps) {
  // Execute the pinned library's real forwardRef render, mocking only hook context.
  return (
    Button as unknown as {
      render: (props: ButtonProps, ref: null) => React.ReactElement<RenderedButtonProps>;
    }
  ).render(props, null);
}
function renderFacade(props: ButtonProps) {
  return renderLibraryButton(NativeButton(props).props);
}
function labelOf(button: React.ReactElement<RenderedButtonProps>) {
  return React.Children.toArray(button.props.children).find(
    (node): node is React.ReactElement<{ children: string; style: StyleProp<TextStyle> }> =>
      React.isValidElement(node) && node.type === Text,
  )!;
}
function luminance(hex: string) {
  const channels = [1, 3, 5]
    .map(start => parseInt(hex.slice(start, start + 2), 16) / 255)
    .map(channel => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
}
function contrast(first: string, second: string) {
  const values = [luminance(first), luminance(second)];
  return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
}
beforeEach(() => {
  mockTheme = toNativeUiTheme(createAppearanceTheme(false), themes.light);
  mockFeedback = undefined;
});

it.each(['quiet', 'secondary'] as const)('renders readable %s text on normal and pressed app surfaces', variant => {
  for (const dark of [false, true]) {
    for (const palette of [
      undefined,
      { primary: defaultTheme.colors.textPrimary, secondary: defaultTheme.colors.background },
    ]) {
      const appTheme = createAppearanceTheme(dark, palette);
      mockTheme = toNativeUiTheme(appTheme, dark ? themes.dark : themes.light);
      const button = renderFacade({ label: 'Go back', variant });
      const foreground = StyleSheet.flatten(labelOf(button).props.style)!.color as string;
      for (const pressed of [false, true]) {
        const background = StyleSheet.flatten(button.props.style({ pressed }))!.backgroundColor;
        const surfaces =
          background === 'transparent'
            ? [mockTheme.colors.background, mockTheme.colors.surface, mockTheme.colors.surfaceRaised]
            : [background as string];
        for (const surface of surfaces) expect(contrast(foreground, surface)).toBeGreaterThanOrEqual(4.5);
      }
    }
  }
});

it('preserves the filled primary surface and its pressed appearance', () => {
  const props = { label: 'Continue' };
  const direct = renderLibraryButton(props);
  const facade = renderFacade(props);
  expect(StyleSheet.flatten(labelOf(facade).props.style)).toEqual(StyleSheet.flatten(labelOf(direct).props.style));
  for (const pressed of [false, true]) {
    expect(StyleSheet.flatten(facade.props.style({ pressed }))).toEqual(
      StyleSheet.flatten(direct.props.style({ pressed })),
    );
  }
  expect(mockTheme.colors.primary).toBe(defaultTheme.colors.actionPrimary);
});

it.each(['quiet', 'secondary', 'primary'] as const)(
  'keeps one callback and one feedback event for an enabled %s action',
  variant => {
    mockFeedback = jest.fn();
    const result = { original: true };
    const onPress = jest.fn(() => result);
    const button = renderFacade({ label: 'Continue', variant, onPress });
    button.props.style({ pressed: true });
    expect(onPress).not.toHaveBeenCalled();
    expect(mockFeedback).not.toHaveBeenCalled();
    const event = { fixture: true };
    expect(button.props.onPress?.(event)).toBe(result);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenCalledWith(event);
    expect(mockFeedback).toHaveBeenCalledTimes(1);
  },
);

it.each([{ disabled: true }, { loading: true }])('retains native disabled/loading gating for %o', state => {
  mockFeedback = jest.fn();
  const onPress = jest.fn();
  const button = renderFacade({ label: 'Continue', variant: 'secondary', onPress, ...state });
  expect(button.props.disabled).toBe(true);
  expect(button.props.onPress).toBeUndefined();
  button.props.style({ pressed: true });
  expect(onPress).not.toHaveBeenCalled();
  expect(mockFeedback).not.toHaveBeenCalled();
  expect(labelOf(button).props.children).toBe('loading' in state ? mockLocale.loading : 'Continue');
});

it('honors an explicit single-button theme without mutating it or changing locale inheritance', () => {
  const override = toNativeUiTheme(createAppearanceTheme(true), themes.dark);
  Object.freeze(override.colors);
  Object.freeze(override);
  const button = renderFacade({ label: 'Continue', variant: 'secondary', theme: override, loading: true });
  expect(StyleSheet.flatten(labelOf(button).props.style)!.color).toBe(override.colors.contentPrimary);
  expect(StyleSheet.flatten(button.props.style({ pressed: true }))!.backgroundColor).toBe(
    override.colors.surfaceRaised,
  );
  expect(labelOf(button).props.children).toBe(mockLocale.loading);
  expect(mockTheme.colors.primary).toBe(defaultTheme.colors.actionPrimary);
  expect(override.colors.primary).toBe(defaultTheme.colors.actionPrimary);
});
