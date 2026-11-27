import React from 'react';
import { Text } from 'react-native';
import { SelectableChip } from '@ui/components/SelectableChip';
import { createNetworkSettings } from '@capabilities/network/createNetworkSettings';
import { DEFAULT_NETWORK_PREFERENCES } from '@capabilities/network/networkPreferences';
import { AccountAvatarPreference } from '../AccountAvatarPreference';

jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useState: (initial: unknown) => {
    const index = mockIndex++;
    if (!(index in mockStates)) mockStates[index] = initial;
    return [
      mockStates[index],
      (value: unknown) => {
        mockStates[index] = value;
      },
    ];
  },
  useRef: (initial: unknown) => ({ current: initial }),
  useSyncExternalStore: (_subscribe: unknown, getSnapshot: () => unknown) => getSnapshot(),
}));
jest.mock('../../../locale', () => ({
  useLocalization: () => jest.requireActual('../../../locale/localization').createLocalization('en'),
}));
jest.mock('@ui/theme', () => {
  const actual = jest.requireActual('@ui/theme');
  return { ...actual, useThemedStyles: (factory: (theme: unknown) => unknown) => factory(actual.defaultTheme) };
});
const mockStates: unknown[] = [];
let mockIndex = 0;
beforeEach(() => {
  mockStates.length = 0;
  mockIndex = 0;
});
function setup() {
  let saved = DEFAULT_NETWORK_PREFERENCES;
  const save = jest.fn((value: typeof saved) => {
    saved = value;
  });
  const settings = createNetworkSettings({
    store: { load: () => saved, save },
    probe: async () => '',
    assertCanSwitch: () => undefined,
    restart: jest.fn(),
    isForeground: () => true,
    hasAvatarAccount: id => id === 'first' || id === 'second',
  });
  function render(accountId = 'first', active = true) {
    mockIndex = 0;
    return AccountAvatarPreference({ accountId, settings, active });
  }
  return { settings, render, save };
}
function chips(root: React.ReactElement<{ children?: React.ReactNode }>) {
  return React.Children.toArray(root.props.children).filter(
    (node): node is React.ReactElement<React.ComponentProps<typeof SelectableChip>> =>
      React.isValidElement(node) && node.type === SelectableChip,
  );
}
const flush = () => new Promise<void>(resolve => setImmediate(resolve));
it('selects local by default, requires global consent, and persists only the selected account', async () => {
  const { settings, render, save } = setup();
  const initial = chips(render());
  expect(initial[0].props).toMatchObject({ selected: true, accessibilityRole: 'radio' });
  expect(initial[1].props).toMatchObject({ selected: false, disabled: true });
  initial[1].props.onPress();
  expect(save).not.toHaveBeenCalled();
  await settings.setExternalAccountAvatarsEnabled(true, true);
  chips(render())[1].props.onPress();
  await flush();
  expect(chips(render())[1].props.selected).toBe(true);
  expect(chips(render('second'))[0].props.selected).toBe(true);
  chips(render())[0].props.onPress();
  await flush();
  expect(chips(render())[0].props.selected).toBe(true);
  expect(chips(render('first', false))[1].props.disabled).toBe(true);
  settings.close();
});
it('preserves local selection and displays failure when the choice cannot be saved', async () => {
  const { settings, render, save } = setup();
  await settings.setExternalAccountAvatarsEnabled(true, true);
  save.mockImplementationOnce(() => {
    throw new Error('disk-full');
  });
  chips(render())[1].props.onPress();
  await flush();
  const root = render();
  expect(chips(root)[0].props.selected).toBe(true);
  expect(
    React.Children.toArray(root.props.children).some(
      node =>
        React.isValidElement<{ accessibilityLiveRegion?: string }>(node) &&
        node.type === Text &&
        node.props.accessibilityLiveRegion === 'polite',
    ),
  ).toBe(true);
  settings.close();
});
