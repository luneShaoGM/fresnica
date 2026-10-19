import React from 'react';
import { Pressable, ScrollView } from 'react-native';

import { Screen } from '@ui/components';
import { NativeButton } from '@ui/components/NativeButton';

import { createLocalization } from '../../../locale/localization';
import { LanguageSettingsScreen } from '../LanguageSettingsScreen';

let mockLocale = 'en';
const mockSetLocale = jest.fn();

jest.mock('@fresnica/ui-native', () => ({
  Button: () => null,
}));

jest.mock('@ui/theme', () => {
  const actual = jest.requireActual('@ui/theme') as typeof import('@ui/theme');
  return {
    ...actual,
    useThemedStyles: (factory: (theme: typeof actual.defaultTheme) => unknown) => factory(actual.defaultTheme),
  };
});

jest.mock('../../../locale', () => {
  const actual = jest.requireActual('../../../locale/localization') as typeof import('../../../locale/localization');
  return {
    useLocalization: () => ({ ...actual.createLocalization(mockLocale), setLocale: mockSetLocale }),
  };
});

type NodeProps = Readonly<{
  children?: React.ReactNode;
  label?: string;
  variant?: string;
  size?: string;
  onPress?: () => void;
  accessibilityRole?: string;
  accessibilityState?: Readonly<{ selected?: boolean }>;
  scrollable?: boolean;
  contentInset?: string;
  showsVerticalScrollIndicator?: boolean;
}>;

function findAll(
  root: React.ReactNode,
  predicate: (element: React.ReactElement<NodeProps>) => boolean,
): React.ReactElement<NodeProps>[] {
  const matches: React.ReactElement<NodeProps>[] = [];
  const visit = (node: React.ReactNode) => {
    if (!React.isValidElement<NodeProps>(node)) return;
    if (predicate(node)) matches.push(node);
    React.Children.forEach(node.props.children, visit);
  };
  visit(root);
  return matches;
}

describe('Language Settings native Back control', () => {
  beforeEach(() => {
    mockLocale = 'en';
    mockSetLocale.mockReset();
  });

  it('exposes a localized quiet button with the original Back callback', () => {
    const onBack = jest.fn();
    const root = LanguageSettingsScreen({ onBack });
    const [button] = findAll(root, element => element.type === NativeButton);

    expect(button?.props).toMatchObject({
      label: createLocalization('en').t('common.back'),
      variant: 'quiet',
      size: 'sm',
    });
    button?.props.onPress?.();
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(mockSetLocale).not.toHaveBeenCalled();
    expect(findAll(root, element => element.type === Screen)[0]?.props).toMatchObject({
      scrollable: false,
      contentInset: 'none',
    });
    expect(findAll(root, element => element.type === ScrollView)[0]?.props.showsVerticalScrollIndicator).toBe(false);
  });

  it('keeps the complete locale list, selected item, and same preference update callback', () => {
    const onBack = jest.fn();
    const root = LanguageSettingsScreen({ onBack });
    const rows = findAll(root, element => element.type === Pressable);
    const locales = createLocalization('en').locales;
    const sortedLocales = [...locales].sort((left, right) => left.englishName.localeCompare(right.englishName));

    expect(rows).toHaveLength(locales.length);
    expect(rows.every(row => row.props.accessibilityRole === 'button')).toBe(true);
    expect(rows.filter(row => row.props.accessibilityState?.selected)).toHaveLength(1);
    expect(rows[sortedLocales.findIndex(option => option.code === 'en')]?.props.accessibilityState?.selected).toBe(
      true,
    );

    const simplifiedChinese = rows[sortedLocales.findIndex(option => option.code === 'zh')];
    simplifiedChinese?.props.onPress?.();
    expect(mockSetLocale).toHaveBeenCalledTimes(1);
    expect(mockSetLocale).toHaveBeenCalledWith('zh');
    expect(onBack).not.toHaveBeenCalled();
  });

  it('retains the selected language and translated Back text for both Chinese locales', () => {
    for (const locale of ['zh', 'zh-TW']) {
      mockLocale = locale;
      const root = LanguageSettingsScreen({ onBack: jest.fn() });
      const button = findAll(root, element => element.type === NativeButton)[0];
      const rows = findAll(root, element => element.type === Pressable);
      const sortedLocales = [...createLocalization(locale).locales].sort((a, b) =>
        a.englishName.localeCompare(b.englishName),
      );
      const selected = rows[sortedLocales.findIndex(option => option.code === locale)];

      expect(button?.props.label).toBe(createLocalization(locale).t('common.back'));
      expect(selected?.props.accessibilityState?.selected).toBe(true);
    }
    expect(mockSetLocale).not.toHaveBeenCalled();
  });
});
