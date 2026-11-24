import React from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { defaultTheme } from '@ui/theme';
import { createAppearanceTheme } from '@ui/theme/appearanceTheme';
import { TransactionResult } from '../TransactionResult';

let mockTheme = createAppearanceTheme(false);
jest.mock('@ui/theme', () => ({
  ...jest.requireActual('@ui/theme'),
  useThemedStyles: (factory: (theme: typeof mockTheme) => unknown) => factory(mockTheme),
}));
type ElementProps = { children?: React.ReactNode; style?: StyleProp<TextStyle & ViewStyle> };
function elements(root: React.ReactNode): React.ReactElement<ElementProps>[] {
  if (!React.isValidElement<ElementProps>(root)) return [];
  return [root, ...React.Children.toArray(root.props.children).flatMap(elements)];
}
function luminance(color: string, background: string): number {
  const parts = color.startsWith('#')
    ? [1, 3, 5].map(start => parseInt(color.slice(start, start + 2), 16))
    : color
        .slice(color.indexOf('(') + 1, -1)
        .split(',')
        .map(Number);
  const alpha = parts[3] ?? 1;
  const channels = parts.slice(0, 3).map((value, index) => {
    const base = parseInt(background.slice(1 + index * 2, 3 + index * 2), 16);
    const channel = (value * alpha + base * (1 - alpha)) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
}
function contrast(foreground: string, background: string): number {
  const first = luminance(foreground, mockTheme.colors.background);
  const second = luminance(background, mockTheme.colors.background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}
it.each(['success', 'failed', 'unverified'] as const)(
  'keeps %s result text readable across light, dark and image palettes',
  tone => {
    for (const dark of [false, true]) {
      for (const palette of [
        undefined,
        { primary: defaultTheme.colors.textPrimary, secondary: defaultTheme.colors.background },
      ]) {
        mockTheme = createAppearanceTheme(dark, palette);
        const root = TransactionResult({
          tone,
          title: 'Result title',
          subtitle: 'Result explanation',
          details: [],
          actions: [],
          primaryAction: { label: 'Continue', onPress: jest.fn() },
        });
        const nodes = elements(root);
        const background = StyleSheet.flatten(root.props.style).backgroundColor as string;
        for (const label of ['Result title', 'Result explanation']) {
          const text = nodes.find(node => node.type === Text && node.props.children === label)!;
          expect(contrast(StyleSheet.flatten(text.props.style)!.color as string, background)).toBeGreaterThanOrEqual(
            4.5,
          );
        }
        const button = nodes.find(node => node.type === Pressable)!;
        const text = nodes.find(node => node.type === Text && node.props.children === 'Continue')!;
        expect(
          contrast(
            StyleSheet.flatten(text.props.style)!.color as string,
            StyleSheet.flatten(button.props.style)!.backgroundColor as string,
          ),
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  },
);
