import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AppModal } from '../../AppModal';
import { BottomSheet } from '../BottomSheet';
import { defaultTheme } from '../../../theme';
import { createAppearanceTheme } from '../../../theme/appearanceTheme';
import { createStyles } from '../styles';

let mockLocale = 'en';
jest.mock('../../../../locale', () => ({
  useLocalization: () => jest.requireActual('../../../../locale/localization').createLocalization(mockLocale),
}));

jest.mock('@ui/theme', () => {
  const actual = jest.requireActual('@ui/theme');
  return { ...actual, useThemedStyles: (factory: (theme: unknown) => unknown) => factory(actual.defaultTheme) };
});

type NodeProps = {
  children?: React.ReactNode;
  style?: React.ComponentProps<typeof View>['style'];
  visible?: boolean;
  dragDismissLabel?: string;
  onRequestClose?: () => void;
};

function find(root: React.ReactNode, target: React.ElementType): React.ReactElement<NodeProps> | undefined {
  if (!React.isValidElement<NodeProps>(root)) return undefined;
  if (root.type === target) return root;
  for (const child of React.Children.toArray(root.props.children)) {
    const match = find(child, target);
    if (match) return match;
  }
  return undefined;
}

describe('shared BottomSheet dismissal', () => {
  it('uses the swipe-enabled shared sheet and keeps all close paths on the caller callback', () => {
    const onClose = jest.fn();
    const child = React.createElement(View, { testID: 'existing-content' });
    const root = BottomSheet({ visible: true, onClose, closeLabel: 'Cancel', children: child });

    const modal = find(root, AppModal);
    expect(modal).toBeDefined();
    expect(modal?.props).toMatchObject({
      visible: true,
      presentation: 'sheet',
      animationType: 'slide',
      swipeToDismiss: true,
      onRequestClose: onClose,
      closeLabel: 'Cancel',
      sheetBackground: 'background',
    });
    expect(modal?.props.dragDismissLabel).toBe('Drag down to close');
    expect(find(modal, View)?.props.children).toBe(child);

    modal?.props.onRequestClose?.();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['en', 'Drag down to close'],
    ['zh', '向下拖动关闭弹窗'],
    ['zh-TW', '向下拖動關閉彈窗'],
  ])('localizes the generic drag-dismiss label in %s', (locale, expected) => {
    mockLocale = locale;
    const modal = find(BottomSheet({ visible: true, onClose: jest.fn() }), AppModal);
    expect(modal?.props.dragDismissLabel).toBe(expected);
    mockLocale = 'en';
  });

  it('matches the legacy panel background on both appearance themes', () => {
    for (const dark of [false, true]) {
      const theme = createAppearanceTheme(dark);
      expect(StyleSheet.flatten(createStyles(theme).panel)?.backgroundColor).toBe(theme.colors.background);
    }
    expect(createAppearanceTheme(true).colors.surface).not.toBe(createAppearanceTheme(true).colors.background);
  });

  it('does not present hidden sheets and preserves a bounded scrolling body', () => {
    const root = BottomSheet({
      visible: false,
      onClose: jest.fn(),
      children: React.createElement(View),
    });
    const modal = find(root, AppModal);
    expect(modal?.props.visible).toBe(false);
    expect(StyleSheet.flatten(find(modal, View)?.props.style)).toMatchObject({
      flex: 1,
      paddingTop: defaultTheme.spacing.md,
      paddingBottom: defaultTheme.spacing.lg,
    });
  });
});
