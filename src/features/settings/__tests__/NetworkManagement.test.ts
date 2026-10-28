import React from 'react';
import { Switch } from 'react-native';
import { Field } from '@ui/components';
import { NativeButton } from '@ui/components/NativeButton';
import { NetworkManagement, networkSettingsError } from '../NetworkManagement';
import { createNetworkSettings } from '@capabilities/network/createNetworkSettings';
import { DEFAULT_NETWORK_PREFERENCES, NETWORKS } from '@capabilities/network/networkPreferences';

jest.mock('@fresnica/ui-native', () => ({ Button: () => null }));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: jest.fn() }));
jest.mock('../../../locale', () => ({
  useLocalization: () => jest.requireActual('../../../locale/localization').createLocalization('en'),
}));
jest.mock('../../../ui/theme', () => {
  const actual = jest.requireActual('../../../ui/theme');
  return { ...actual, useThemedStyles: (fn: (theme: unknown) => unknown) => fn(actual.defaultTheme) };
});
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useState: jest.fn((initial: unknown) => [initial, jest.fn()]),
  useRef: (initial: unknown) => ({ current: initial }),
  useEffect: jest.fn(),
  useCallback: (fn: unknown) => fn,
  useSyncExternalStore: (_subscribe: unknown, get: () => unknown) => get(),
}));
type Props = {
  children?: React.ReactNode;
  label?: string;
  secureTextEntry?: boolean;
  onChangeText?: (text: string) => void;
  onPress?: () => void;
  disabled?: boolean;
  value?: boolean;
  onValueChange?: (value: boolean) => void;
};
function nodes(root: React.ReactNode): React.ReactElement<Props>[] {
  if (!React.isValidElement<Props>(root)) return [];
  return [root, ...React.Children.toArray(root.props.children).flatMap(nodes)];
}
function setup(developerMode = false, retainedTestnet = false) {
  const authorize = jest.fn(async () => {});
  const settings = createNetworkSettings({
    initial: { ...DEFAULT_NETWORK_PREFERENCES, developerMode, ...(retainedTestnet ? { retainedTestnet: true } : {}) },
    store: { load: () => undefined, save: jest.fn() },
    authorize,
    probe: async () => NETWORKS['stellar-mainnet'].networkPassphrase,
    assertCanSwitch: () => {},
    restart: () => {},
    isForeground: () => true,
  });
  return { settings, authorize };
}
beforeEach(() => jest.clearAllMocks());
describe('network management presentation and event wiring', () => {
  it('separates Advanced mode and node controls while keeping bootstrap controls together', () => {
    const { settings } = setup(true);
    const advanced = nodes(NetworkManagement({ settings, section: 'developer-mode' }));
    expect(advanced.some(n => n.type === Switch)).toBe(true);
    expect(advanced.some(n => n.type === NativeButton && n.props.label === 'Add node')).toBe(false);
    const network = nodes(NetworkManagement({ settings, section: 'nodes' }));
    expect(network.some(n => n.type === Switch)).toBe(false);
    expect(network.filter(n => n.type === NativeButton && n.props.label === 'Add node')).toHaveLength(2);
    const bootstrap = nodes(NetworkManagement({ settings }));
    expect(bootstrap.some(n => n.type === Switch)).toBe(true);
    expect(bootstrap.some(n => n.type === NativeButton && n.props.label === 'Add node')).toBe(true);
  });
  it('requests a warning first without changing persisted mode or authenticating', () => {
    const { settings, authorize } = setup();
    const setPrompt = jest.fn();
    jest.mocked(React.useState).mockReturnValueOnce([undefined, setPrompt]);
    const all = nodes(NetworkManagement({ settings, section: 'developer-mode' }));
    all.find(n => n.type === Switch)?.props.onValueChange?.(true);
    expect(setPrompt).toHaveBeenCalledWith({ kind: 'enable-warning' });
    expect(authorize).not.toHaveBeenCalled();
    expect(settings.getSnapshot().preferences.developerMode).toBe(false);
  });
  it('continues from warning to fresh credential entry without authorizing and permits cancellation', async () => {
    const { settings, authorize } = setup();
    const setPrompt = jest.fn();
    jest.mocked(React.useState).mockReturnValueOnce([{ kind: 'enable-warning' }, setPrompt]);
    const all = nodes(NetworkManagement({ settings, section: 'developer-mode' }));
    await all.find(n => n.type === NativeButton && n.props.label === 'Continue')?.props.onPress?.();
    expect(setPrompt).toHaveBeenCalledWith({ kind: 'enable' });
    expect(authorize).not.toHaveBeenCalled();
    all.find(n => n.type === NativeButton && n.props.label === 'Cancel')?.props.onPress?.();
    expect(setPrompt).toHaveBeenLastCalledWith(undefined);
    expect(settings.getSnapshot().preferences.developerMode).toBe(false);
  });
  it('hides Testnet and node mutation controls while mode is disabled', () => {
    const { settings } = setup();
    const all = nodes(NetworkManagement({ settings }));
    const labels = all.filter(n => n.type === NativeButton).map(n => n.props.label);
    expect(all.find(n => n.type === Switch)?.props.value).toBe(false);
    expect(labels).not.toContain('Add node');
    expect(labels).not.toContain('Remove node');
    expect(all.some(n => String(n.props.children).includes('Stellar Testnet'))).toBe(false);
  });
  it('shows the retained built-in Testnet partition without revealing custom-node controls', () => {
    const { settings } = setup(false, true);
    const all = nodes(NetworkManagement({ settings }));
    expect(all.some(node => String(node.props.children).includes('Stellar Testnet'))).toBe(true);
    const labels = all.filter(node => node.type === NativeButton).map(node => node.props.label);
    expect(labels).toContain('Use node');
    expect(labels).not.toContain('Add node');
    expect(labels).not.toContain('Remove node');
    expect(settings.getSnapshot().preferences.developerMode).toBe(false);
  });
  it('uses a secure transient field and forwards a fresh credential only on explicit confirmation', async () => {
    const { settings, authorize } = setup();
    jest
      .mocked(React.useState)
      .mockReturnValueOnce([{ kind: 'enable' }, jest.fn()])
      .mockReturnValueOnce(['', jest.fn()])
      .mockReturnValueOnce([undefined, jest.fn()]);
    const all = nodes(NetworkManagement({ settings }));
    const field = all.find(n => n.type === Field);
    expect(field?.props.secureTextEntry).toBe(true);
    field?.props.onChangeText?.('fresh secret');
    expect(authorize).not.toHaveBeenCalled();
    all.find(n => n.type === NativeButton && n.props.label === 'Confirm')?.props.onPress?.();
    for (let i = 0; i < 12; i += 1) await Promise.resolve();
    expect(authorize).toHaveBeenCalledWith('fresh secret', expect.any(AbortSignal));
    expect(settings.getSnapshot().preferences.developerMode).toBe(true);
    expect(JSON.stringify(settings.getSnapshot())).not.toContain('fresh secret');
  });
  it('exposes built-in nodes without removal controls and projects no raw exception text', () => {
    const { settings } = setup(true);
    const labels = nodes(NetworkManagement({ settings }))
      .filter(n => n.type === NativeButton)
      .map(n => n.props.label);
    expect(labels.filter(label => label === 'Add node')).toHaveLength(2);
    expect(labels).not.toContain('Remove node');
    expect(networkSettingsError(new Error('token=private'))).toBe('networkManage.error.failed');
    expect(networkSettingsError(new Error('pending-submission'))).toBe('networkManage.error.pending-submission');
  });
});
