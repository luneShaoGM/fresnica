import React from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';

import { defaultTheme } from '@ui/theme';
import { createAppearanceTheme } from '@ui/theme/appearanceTheme';

import { SelectableChip } from '../SelectableChip';
import { createStyles } from '../styles';

jest.mock('@ui/theme', () => {
  const actual = jest.requireActual<typeof import('@ui/theme')>('@ui/theme');
  return {
    ...actual,
    useThemedStyles: (factory: (theme: typeof actual.defaultTheme) => unknown) => factory(actual.defaultTheme),
  };
});

describe('SelectableChip', () => {
  it.each([
    ['light', false],
    ['dark', true],
  ])('matches the selected text to the selected surface in %s mode', (_mode, dark) => {
    const theme = createAppearanceTheme(dark);
    const styles = createStyles(theme);

    expect(styles.selected.backgroundColor).toBe(theme.colors.surfaceStrong);
    expect(styles.selectedText.color).toBe(theme.colors.onSurfaceStrong);
    expect(styles.chip.backgroundColor).toBe(theme.colors.surfaceMuted);
    expect(styles.text.color).toBe(theme.colors.textSecondary);
  });

  it('keeps selection contrast with a custom palette', () => {
    const theme = createAppearanceTheme(true, {
      primary: defaultTheme.colors.actionPrimary,
      secondary: defaultTheme.colors.surfaceStrong,
    });
    const styles = createStyles(theme);

    expect(styles.selectedText.color).toBe(theme.colors.onSurfaceStrong);
    expect(styles.selected.backgroundColor).toBe(theme.colors.surfaceStrong);
  });

  it('exposes a regular radio label, selected state and click handler', () => {
    const onPress = jest.fn();
    const chip = SelectableChip({ label: 'Payments', selected: true, accessibilityRole: 'radio', onPress });
    const label = React.Children.only(chip.props.children) as React.ReactElement<{
      children: string;
      style: StyleProp<TextStyle>;
    }>;

    expect(chip.type).toBe(Pressable);
    expect(chip.props.accessibilityRole).toBe('radio');
    expect(chip.props.accessibilityState).toEqual({ selected: true, disabled: false });
    expect(StyleSheet.flatten(chip.props.style({ pressed: false }))).toMatchObject({
      minHeight: 44,
      backgroundColor: defaultTheme.colors.surfaceStrong,
    });
    expect(label.type).toBe(Text);
    expect(label.props.children).toBe('Payments');
    expect(StyleSheet.flatten(label.props.style)).toMatchObject({
      color: defaultTheme.colors.onSurfaceStrong,
    });

    chip.props.onPress();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('uses the compact size and disables interaction when requested', () => {
    const onPress = jest.fn();
    const chip = SelectableChip({ label: 'Exchange', selected: false, size: 'compact', disabled: true, onPress });
    const label = React.Children.only(chip.props.children) as React.ReactElement<{ style: StyleProp<TextStyle> }>;

    expect(chip.props.accessibilityRole).toBe('button');
    expect(chip.props.accessibilityState).toEqual({ selected: false, disabled: true });
    expect(chip.props.disabled).toBe(true);
    expect(StyleSheet.flatten(chip.props.style({ pressed: false }))).toMatchObject({
      height: 32,
      paddingHorizontal: 14,
      opacity: 0.45,
    });
    expect(StyleSheet.flatten(label.props.style)).toMatchObject({
      fontSize: 11,
      color: defaultTheme.colors.textSecondary,
    });
  });
});
