jest.mock('@fresnica/ui-native', () => ({ Button: () => null }));
import React from 'react';
import { GeneralSettingsScreen } from '../GeneralSettingsScreen';
import { ThemeSettingsScreen } from '../ThemeSettingsScreen/ThemeSettingsScreen';
import { SessionLogsScreen } from '../SessionLogsScreen/SessionLogsScreen';
import type { NetworkSettings } from '@capabilities/network/createNetworkSettings';
let mockCleanup: (() => void) | undefined;
const mockUpdate = jest.fn();
let mockLocale = 'en';
let mockFexPreference: boolean | undefined;
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useState: (value: unknown) => [value, jest.fn()],
  useRef: (value: unknown) => ({ current: value }),
  useEffect: (effect: () => (() => void) | undefined) => {
    mockCleanup = effect();
  },
  useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot(),
}));
jest.mock('../generalPreferences', () => ({
  useGeneralPreferences: () => ({
    controller: { update: mockUpdate },
    preferences: {
      ...jest.requireActual('@capabilities/preferences/generalPreferences').DEFAULT_GENERAL_PREFERENCES,
      activityFexShortcut: mockFexPreference,
    },
  }),
}));
jest.mock('@ui/components', () => ({ Button: () => null, ListRow: () => null }));
jest.mock('../../../locale', () => ({
  useLocalization: () => ({ t: (key: string) => key, locale: mockLocale, locales: [] }),
}));
jest.mock('@ui/theme', () => {
  const actual = jest.requireActual('@ui/theme');
  return { ...actual, useThemedStyles: (factory: (theme: unknown) => unknown) => factory(actual.defaultTheme) };
});
function find(root: React.ReactNode, label: string): (() => Promise<void>) | undefined {
  if (!React.isValidElement<{ label?: string; onPress?: () => Promise<void>; children?: React.ReactNode }>(root))
    return;
  if (root.props.label === label) return root.props.onPress;
  for (const child of React.Children.toArray(root.props.children)) {
    const hit = find(child, label);
    if (hit) return hit;
  }
}
beforeEach(() => {
  mockUpdate.mockClear();
  mockCleanup = undefined;
  mockLocale = 'en';
  mockFexPreference = undefined;
});
it('starts a service-owned picker that survives gate unmount, but cancels on explicit back or blur', async () => {
  const selection = {
    getSnapshot: () => ({ busy: false, error: false }),
    subscribe: jest.fn(),
    start: jest.fn(async () => {}),
    cancel: jest.fn(),
    close: jest.fn(),
  };
  const onBack = jest.fn();
  const root = ThemeSettingsScreen({ active: true, selection, onBack });
  await find(root, 'preferences.pickImage')?.();
  expect(selection.start).toHaveBeenCalledTimes(1);
  mockCleanup?.();
  expect(selection.cancel).not.toHaveBeenCalled();
  root.props.onBack();
  expect(selection.cancel).toHaveBeenCalledTimes(1);
  expect(onBack).toHaveBeenCalledTimes(1);
  ThemeSettingsScreen({ active: false, selection, onBack });
  expect(selection.cancel).toHaveBeenCalledTimes(2);
  expect(mockUpdate).not.toHaveBeenCalled();
});
it('exports only an explicit developer-mode session snapshot and gates disabled mode', async () => {
  const share = jest.fn(async () => undefined),
    source = { exportSession: jest.fn(() => '{safe-events}'), clear: jest.fn() };
  const settings = {
    subscribe: jest.fn(),
    getSnapshot: () => ({ preferences: { developerMode: true } }),
  } as unknown as NetworkSettings;
  const root = SessionLogsScreen({ source, settings, share, active: true, onBack: jest.fn() });
  expect(share).not.toHaveBeenCalled();
  await find(root, 'preferences.export')?.();
  expect(share).toHaveBeenCalledWith('{safe-events}');
  mockCleanup?.();
  const disabled = SessionLogsScreen({
    source,
    settings: {
      ...settings,
      getSnapshot: () => ({ preferences: { developerMode: false } }),
    } as unknown as NetworkSettings,
    share,
    active: true,
    onBack: jest.fn(),
  });
  expect(find(disabled, 'preferences.export')).toBeUndefined();
  mockCleanup?.();
});

type SwitchProps = { value: boolean; onValueChange: (value: boolean) => void };
function findFexSwitch(root: React.ReactNode): React.ReactElement<SwitchProps> | undefined {
  if (!React.isValidElement<{ title?: string; trailing?: React.ReactNode; children?: React.ReactNode }>(root)) return;
  if (root.props.title === 'settings.activityFexShortcut' && React.isValidElement<SwitchProps>(root.props.trailing))
    return root.props.trailing;
  for (const child of React.Children.toArray(root.props.children)) {
    const hit = findFexSwitch(child);
    if (hit) return hit;
  }
}
it.each(['zh', 'zh-TW'])('exposes a persisted FEX setting only for Chinese UI: %s', locale => {
  mockLocale = locale;
  const props = { onBack: jest.fn(), onOpenLanguage: jest.fn() };
  const initial = findFexSwitch(GeneralSettingsScreen(props));
  expect(initial?.props.value).toBe(true);
  initial?.props.onValueChange(false);
  expect(mockUpdate).toHaveBeenCalledWith({ activityFexShortcut: false });
  mockFexPreference = false;
  const off = findFexSwitch(GeneralSettingsScreen(props));
  expect(off?.props.value).toBe(false);
  off?.props.onValueChange(true);
  expect(mockUpdate).toHaveBeenLastCalledWith({ activityFexShortcut: true });
  mockLocale = 'en';
  expect(findFexSwitch(GeneralSettingsScreen(props))).toBeUndefined();
});
