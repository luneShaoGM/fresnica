import React from 'react';
import { Text } from 'react-native';

import { createLocalization } from '../../../locale/localization';
import { defaultTheme } from '../../../ui/theme';
import { REFERENCE_AGREEMENT_VERSION, TermsScreen } from '../TermsScreen';

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

it('shows only pending reference status and never a published legal agreement or acceptance action', () => {
  const node = TermsScreen({ onBack: jest.fn() });
  const content = node.props.children as React.ReactElement<{ children: React.ReactNode }>;
  const lines = React.Children.toArray(content.props.children) as React.ReactElement<{ children: React.ReactNode }>[];
  expect(REFERENCE_AGREEMENT_VERSION).toBe('20260713');
  expect(lines).toHaveLength(3);
  expect(lines.every(line => line.type === Text)).toBe(true);
  expect(lines[0].props.children).toContain(REFERENCE_AGREEMENT_VERSION);
  expect(lines[1].props.children).toBe(createLocalization('en').t('settings.termsPendingApproval'));
});

it('shows a localized support failure message', () => {
  const node = TermsScreen({ onBack: jest.fn(), supportError: true });
  expect((node.props.children as React.ReactElement).type).toBe(Text);
  expect((node.props.children as React.ReactElement<{ children: string }>).props.children).toBe(
    createLocalization('en').t('settings.supportOpenFailed'),
  );
});

it.each(['en', 'zh', 'zh-TW'] as const)('has localized support and reference copy for %s', language => {
  const t = createLocalization(language).t;
  expect(t('settings.supportOpenFailed')).not.toBe('settings.supportOpenFailed');
  expect(t('settings.termsReferenceVersion')).not.toBe('settings.termsReferenceVersion');
  expect(t('settings.termsPendingApproval')).not.toBe('settings.termsPendingApproval');
  expect(t('settings.termsNotAccepted')).not.toBe('settings.termsNotAccepted');
});

it('renders approved long-form content as separate accessible read-only paragraphs', () => {
  const longText = 'Legal detail '.repeat(500);
  const node = TermsScreen({
    onBack: jest.fn(),
    approvedDocument: {
      version: '20261104',
      title: 'Approved for test only',
      sections: [
        { kind: 'heading', text: 'Scope' },
        { kind: 'paragraph', text: longText },
      ],
    },
  });
  const content = node.props.children as React.ReactElement<{ children: React.ReactNode }>;
  const lines = React.Children.toArray(content.props.children) as React.ReactElement<{
    children: React.ReactNode;
    accessibilityRole?: string;
  }>[];
  expect(lines).toHaveLength(5);
  expect(lines[0].props.accessibilityRole).toBe('header');
  expect(lines[2].props.accessibilityRole).toBe('header');
  expect(lines[3].props.children).toBe(longText);
  expect(lines[4].props.children).toBe(createLocalization('en').t('settings.termsNotAccepted'));
});

it('keeps malformed documents fail-closed with no legal paragraphs or accept controls', () => {
  const node = TermsScreen({ onBack: jest.fn(), approvedDocument: { version: '20261104', title: '', sections: [] } });
  const content = node.props.children as React.ReactElement<{ children: React.ReactNode }>;
  const lines = React.Children.toArray(content.props.children) as React.ReactElement<{ children: React.ReactNode }>[];
  expect(lines).toHaveLength(3);
  expect(lines[1].props.children).toBe(createLocalization('en').t('settings.termsInvalidDocument'));
});
