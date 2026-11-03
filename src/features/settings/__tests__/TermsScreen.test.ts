import React from 'react';
import { Text } from 'react-native';

import { defaultTheme } from '../../../ui/theme';
import { TermsScreen } from '../TermsScreen';
import agreement from '../serviceAgreementContent.json';

jest.mock('@fresnica/ui-native', () => ({ Screen: () => null, Button: () => null }));
jest.mock('../../../ui/theme', () => {
  const actual = jest.requireActual('../../../ui/theme') as typeof import('../../../ui/theme');
  return {
    ...actual,
    useThemedStyles: (factory: (theme: typeof actual.defaultTheme) => unknown) => factory(actual.defaultTheme),
  };
});
jest.mock('../../../locale', () => {
  const actual = jest.requireActual('../../../locale/localization') as typeof import('../../../locale/localization');
  return { useLocalization: () => actual.createLocalization('en') };
});

it('presents the approved versioned document without an acceptance side effect', () => {
  const node = TermsScreen({ onBack: jest.fn() });
  const children = React.Children.toArray(node.props.children);
  const content = children[0] as React.ReactElement<{ children: React.ReactNode }>;
  const sections = React.Children.toArray(content.props.children);
  expect(agreement.version).toBe(20260713);
  expect(agreement.sections.length).toBeGreaterThan(10);
  expect(sections).toHaveLength(agreement.sections.length + 1);
  expect(sections.slice(1).every(item => React.isValidElement(item) && item.type === Text)).toBe(true);
});

it('shows a non-destructive support failure message', () => {
  const node = TermsScreen({ onBack: jest.fn(), supportError: true });
  expect(React.isValidElement(node.props.children)).toBe(true);
  expect((node.props.children as React.ReactElement).type).toBe(Text);
});
