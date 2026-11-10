import React from 'react';
import { Switch, Text } from 'react-native';
import { createNetworkSettings } from '../../../capabilities/network/createNetworkSettings';
import { DEFAULT_NETWORK_PREFERENCES } from '../../../capabilities/network/networkPreferences';
import { PrivacySettingsScreen } from '../PrivacySettingsScreen';

jest.mock('@fresnica/ui-native', () => ({ Button: () => null, Screen: () => null }));
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useState: (initial: unknown) => [initial, jest.fn()],
  useSyncExternalStore: (_subscribe: unknown, getSnapshot: () => unknown) => getSnapshot(),
}));
jest.mock('../../../locale', () => ({
  useLocalization: () => jest.requireActual('../../../locale/localization').createLocalization('en'),
}));
jest.mock('../../../ui/theme', () => {
  const actual = jest.requireActual('../../../ui/theme');
  return { ...actual, useThemedStyles: (factory: (theme: unknown) => unknown) => factory(actual.defaultTheme) };
});

type NodeProps = Readonly<{
  children?: React.ReactNode;
  value?: boolean;
  disabled?: boolean;
  onValueChange?: (value: boolean) => void;
}>;
function elements(root: React.ReactNode, type: unknown): React.ReactElement<NodeProps>[] {
  const result: React.ReactElement<NodeProps>[] = [];
  const walk = (node: React.ReactNode) => {
    if (!React.isValidElement<NodeProps>(node)) return;
    if (node.type === type) result.push(node);
    React.Children.forEach(node.props.children, walk);
  };
  walk(root);
  return result;
}

function createSettings() {
  let saved = DEFAULT_NETWORK_PREFERENCES;
  const write = jest.fn((next: typeof DEFAULT_NETWORK_PREFERENCES) => {
    saved = next;
  });
  const settings = createNetworkSettings({
    initial: DEFAULT_NETWORK_PREFERENCES,
    store: { load: () => saved, save: write },
    authorize: async () => undefined,
    probe: async () => '',
    assertCanSwitch: () => undefined,
    restart: jest.fn(),
    isForeground: () => true,
  });
  return { settings, write };
}

describe('single wallet-wide token image privacy control', () => {
  it('shows automatic external image requests and accurately explains IP, request time and opt-out', async () => {
    const { settings, write } = createSettings();
    const render = () => PrivacySettingsScreen({ settings, onBack: jest.fn() });
    const first = render();
    const input = elements(first, Switch)[0];
    expect(input.props.value).toBe(true);
    expect(input.props.disabled).toBe(false);
    const descriptions = elements(first, Text)
      .map(element => String(element.props.children))
      .join(' ');
    expect(descriptions).toContain('IP address');
    expect(descriptions).toContain('request time');
    expect(descriptions).toContain('both networks');
    input.props.onValueChange?.(false);
    await new Promise<void>(resolve => setImmediate(resolve));
    expect(write).toHaveBeenCalledWith(expect.objectContaining({ externalTokenImagesEnabled: false }));
    expect(elements(render(), Switch)[0].props.value).toBe(false);
    settings.close();
  });

  it('does not show an enabled writable toggle when persistent preferences are unavailable', () => {
    const page = PrivacySettingsScreen({ settings: undefined, onBack: jest.fn() });
    const input = elements(page, Switch)[0];
    expect(input.props.disabled).toBe(true);
    expect(input.props.value).toBe(true);
  });
});

it('requires independent persisted address-avatar consent and explains full address disclosure', async () => {
  const { settings, write } = createSettings();
  const render = () => PrivacySettingsScreen({ settings, onBack: jest.fn() });
  expect(elements(render(), Switch)[1].props.value).toBe(true);
  const text = elements(render(), Text)
    .map(element => String(element.props.children))
    .join(' ');
  expect(text).toContain('horizon.stellarcn.org');
  expect(text).toContain('displayed wallet');
  elements(render(), Switch)[1].props.onValueChange?.(true);
  await new Promise<void>(resolve => setImmediate(resolve));
  expect(write).toHaveBeenCalledWith(
    expect.objectContaining({ externalAccountAvatarsEnabled: true, externalTokenImagesEnabled: true }),
  );
  elements(render(), Switch)[0].props.onValueChange?.(false);
  await new Promise<void>(resolve => setImmediate(resolve));
  expect(elements(render(), Switch)[1].props.value).toBe(true);
  elements(render(), Switch)[1].props.onValueChange?.(false);
  await new Promise<void>(resolve => setImmediate(resolve));
  expect(settings.getSnapshot().preferences.externalAccountAvatarsEnabled).toBe(false);
  settings.close();
});
