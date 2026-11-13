import React from 'react';
import { DEFAULT_GENERAL_PREFERENCES } from '@capabilities/preferences/generalPreferences';
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
jest.mock('../generalPreferences', () => ({
  useGeneralPreferences: () => ({
    preferences: jest.requireActual('@capabilities/preferences/generalPreferences').DEFAULT_GENERAL_PREFERENCES,
    controller: { update: jest.fn() },
  }),
}));
jest.mock('react', () => ({ ...jest.requireActual('react'), useState: (initial: unknown) => [initial, jest.fn()] }));
type Props = { children?: React.ReactNode; title?: string; subtitle?: string; onPress?: () => void; section?: string };
function nodes(node: React.ReactNode): React.ReactElement<Props>[] {
  if (!React.isValidElement<Props>(node)) return [];
  return [node, ...React.Children.toArray(node.props.children).flatMap(nodes)];
}
it('General opens Language/Theme and exposes real persisted preference controls', () => {
  const onOpenLanguage = jest.fn(),
    onOpenTheme = jest.fn();
  const all = nodes(GeneralSettingsScreen({ onBack: jest.fn(), onOpenLanguage, onOpenTheme }));
  const rows = all.filter(n => n.type === ListRow);
  rows.find(n => n.props.title === 'Language')?.props.onPress?.();
  rows.find(n => n.props.title === 'Theme')?.props.onPress?.();
  expect(onOpenLanguage).toHaveBeenCalledTimes(1);
  expect(onOpenTheme).toHaveBeenCalledTimes(1);
  for (const currency of ['USD', 'EUR', 'CNY'])
    expect(rows.find(n => n.props.title === currency)?.props.onPress).toBeDefined();
  expect(DEFAULT_GENERAL_PREFERENCES.reserveDisplay).toBe(true);
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
