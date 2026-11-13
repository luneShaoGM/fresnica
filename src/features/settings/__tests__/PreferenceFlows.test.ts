jest.mock('@fresnica/ui-native', () => ({ Button: () => null }));
import React from 'react';
import { ThemeSettingsScreen } from '../ThemeSettingsScreen/ThemeSettingsScreen';
import { SessionLogsScreen } from '../SessionLogsScreen/SessionLogsScreen';
import type { NetworkSettings } from '@capabilities/network/createNetworkSettings';
let mockCleanup: (() => void) | undefined;
const mockUpdate = jest.fn();
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
    preferences: jest.requireActual('@capabilities/preferences/generalPreferences').DEFAULT_GENERAL_PREFERENCES,
  }),
}));
jest.mock('@ui/components', () => ({ Button: () => null, ListRow: () => null }));
jest.mock('../../../locale', () => ({ useLocalization: () => ({ t: (key: string) => key }) }));
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
});
it('keeps the old theme on picker cancellation and refuses a late picker result after unmount', async () => {
  const props = {
    active: true,
    pickPalette: jest.fn(async () => undefined),
    cancelPalette: jest.fn(),
    onBack: jest.fn(),
  };
  let root = ThemeSettingsScreen(props);
  await find(root, 'preferences.pickImage')?.();
  expect(mockUpdate).not.toHaveBeenCalled();
  mockCleanup?.();
  let finish: (palette: { primary: string; secondary: string }) => void = () => undefined;
  root = ThemeSettingsScreen({
    ...props,
    pickPalette: () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  });
  const pending = find(root, 'preferences.pickImage')?.();
  mockCleanup?.();
  finish({ primary: '#113355', secondary: '#224466' });
  await pending;
  expect(mockUpdate).not.toHaveBeenCalled();
});
it('saves validated picker output only for the current screen', async () => {
  const imagePalette = { primary: '#113355', secondary: '#224466' };
  const root = ThemeSettingsScreen({
    active: true,
    pickPalette: async () => imagePalette,
    cancelPalette: jest.fn(),
    onBack: jest.fn(),
  });
  await find(root, 'preferences.pickImage')?.();
  expect(mockUpdate).toHaveBeenCalledWith({ theme: 'image', imagePalette });
  mockCleanup?.();
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
