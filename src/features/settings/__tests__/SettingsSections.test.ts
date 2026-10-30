import React from 'react';
import { ListRow } from '@ui/components';
import { GeneralSettingsScreen } from '../GeneralSettingsScreen';
import { AdvancedSettingsScreen } from '../AdvancedSettingsScreen';
import { NetworkManagement } from '../NetworkManagement';

jest.mock('@fresnica/ui-native', () => ({ Button: () => null }));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: jest.fn() }));
jest.mock('../../../locale', () => ({
  useLocalization: () => jest.requireActual('../../../locale/localization').createLocalization('en'),
}));
jest.mock('../../../ui/theme', () => {
  const actual = jest.requireActual('../../../ui/theme');
  return { ...actual, useThemedStyles: (factory: (theme: unknown) => unknown) => factory(actual.defaultTheme) };
});
type Props = { children?: React.ReactNode; title?: string; subtitle?: string; onPress?: () => void; section?: string };
function nodes(node: React.ReactNode): React.ReactElement<Props>[] {
  if (!React.isValidElement<Props>(node)) return [];
  return [node, ...React.Children.toArray(node.props.children).flatMap(nodes)];
}
it('General opens the existing Language flow and leaves unimplemented preference roles non-interactive', () => {
  const onOpenLanguage = jest.fn();
  const all = nodes(GeneralSettingsScreen({ onBack: jest.fn(), onOpenLanguage }));
  const rows = all.filter(n => n.type === ListRow);
  rows.find(n => n.props.title === 'Language')?.props.onPress?.();
  expect(onOpenLanguage).toHaveBeenCalledTimes(1);
  for (const title of [
    'Theme',
    'Follow system appearance',
    'Display currency',
    'Haptic feedback',
    'Use system number separators',
    'Show reserve value',
  ]) {
    expect(rows.find(n => n.props.title === title)?.props).toMatchObject({ subtitle: 'Not available in this version' });
    expect(rows.find(n => n.props.title === title)?.props.onPress).toBeUndefined();
  }
});
it('Advanced always exposes Network and About, and shows no fictitious mode switch if management is unavailable', () => {
  const onOpenNetwork = jest.fn(),
    onOpenAbout = jest.fn();
  const all = nodes(AdvancedSettingsScreen({ onBack: jest.fn(), onOpenNetwork, onOpenAbout }));
  all.find(n => n.type === ListRow && n.props.title === 'Network')?.props.onPress?.();
  all.find(n => n.type === ListRow && n.props.title === 'About')?.props.onPress?.();
  expect(onOpenNetwork).toHaveBeenCalledTimes(1);
  expect(onOpenAbout).toHaveBeenCalledTimes(1);
  expect(all.some(n => n.type === NetworkManagement)).toBe(false);
  for (const title of ['App version', 'Change log', 'Device identifier', 'Session logs'])
    expect(all.find(n => n.type === ListRow && n.props.title === title)?.props.onPress).toBeUndefined();
});
