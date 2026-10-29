import React from 'react';
import { AppModal, Field } from '@ui/components';
import { NativeButton } from '@ui/components/NativeButton';
import { createNetworkSettings } from '@capabilities/network/createNetworkSettings';
import {
  DEFAULT_NETWORK_PREFERENCES,
  NETWORKS,
  type NetworkPreferences,
} from '@capabilities/network/networkPreferences';
import { NetworkSwitchModal } from '../NetworkSwitchModal';

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
  useState: jest.fn(),
  useRef: (initial: unknown) => ({ current: initial }),
  useEffect: jest.fn(),
  useCallback: (fn: unknown) => fn,
  useSyncExternalStore: (_subscribe: unknown, get: () => unknown) => get(),
}));
type Prompt = { kind: 'select' | 'remove' | 'added'; id: 'stellar-mainnet' | 'stellar-testnet'; endpoint: string };
type Props = {
  children?: React.ReactNode;
  label?: string;
  presentation?: string;
  accessibilityLabel?: string;
  accessibilityRole?: string;
  accessibilityState?: { checked?: boolean; disabled?: boolean };
  value?: string;
  disabled?: boolean;
  onPress?: () => Promise<void> | void;
  onRequestClose?: () => void;
};
function nodes(root: React.ReactNode): React.ReactElement<Props>[] {
  if (!React.isValidElement<Props>(root)) return [];
  return [root, ...React.Children.toArray(root.props.children).flatMap(nodes)];
}
function setup(initial: Partial<NetworkPreferences> = {}, assertCanSwitch = () => {}) {
  const save = jest.fn();
  const restart = jest.fn();
  const probe = jest.fn(async (endpoint: string) =>
    endpoint.includes('testnet')
      ? (NETWORKS['stellar-testnet'].networkPassphrase as string)
      : (NETWORKS['stellar-mainnet'].networkPassphrase as string),
  );
  const settings = createNetworkSettings({
    initial: { ...DEFAULT_NETWORK_PREFERENCES, developerMode: true, ...initial },
    store: { load: () => undefined, save },
    authorize: async () => {},
    probe,
    assertCanSwitch,
    restart,
    isForeground: () => true,
  });
  const onClose = jest.fn();
  return { settings, save, restart, probe, onClose };
}
function render(
  deps: ReturnType<typeof setup>,
  prompt?: Prompt,
  expanded = deps.settings.getSnapshot().preferences.networkId,
  input = '',
) {
  const setExpanded = jest.fn();
  const setPrompt = jest.fn();
  const setInput = jest.fn();
  const setError = jest.fn();
  jest
    .mocked(React.useState)
    .mockReturnValueOnce([expanded, setExpanded])
    .mockReturnValueOnce([prompt, setPrompt])
    .mockReturnValueOnce([input, setInput])
    .mockReturnValueOnce([undefined, setError]);
  return { all: nodes(NetworkSwitchModal(deps)), setExpanded, setPrompt, setInput, setError };
}
function button(all: React.ReactElement<Props>[], label: string) {
  const found = all.find(
    node => node.props.accessibilityLabel === label || (node.type === NativeButton && node.props.label === label),
  );
  if (!found) throw new Error(`Missing action: ${label}`);
  return found.props;
}
const testPrompt: Prompt = { kind: 'select', id: 'stellar-testnet', endpoint: NETWORKS['stellar-testnet'].horizonUrl };
beforeEach(() => jest.clearAllMocks());
describe('Home network panel', () => {
  it('shows network identity/default endpoint/radio and expanded node test/select/add controls in a bottom sheet', () => {
    const deps = setup();
    const { all } = render(deps);
    expect(all.find(node => node.type === AppModal)?.props.presentation).toBe('sheet');
    expect(button(all, 'Use network: Stellar Mainnet').accessibilityState?.checked).toBe(true);
    expect(button(all, `Use node: ${NETWORKS['stellar-mainnet'].horizonUrl}`).accessibilityState?.checked).toBe(true);
    expect(button(all, `Test node: ${NETWORKS['stellar-mainnet'].horizonUrl}`)).toBeDefined();
    expect(all.some(node => node.props.accessibilityLabel?.startsWith('Remove node:'))).toBe(false);
    expect(all.some(node => node.type === Field && node.props.label === 'Add Horizon endpoint')).toBe(true);
    expect(button(all, 'Add node (Stellar Mainnet)').disabled).toBe(true);
    expect(deps.save).not.toHaveBeenCalled();
  });
  it('hides gated Testnet/custom mutation controls without retention, and opens confirmation before switching', () => {
    const hidden = render(setup({ developerMode: false }));
    expect(hidden.all.some(node => node.props.accessibilityLabel?.includes('Stellar Testnet'))).toBe(false);
    expect(hidden.all.some(node => node.type === Field)).toBe(false);
    const deps = setup();
    const { all, setExpanded, setPrompt } = render(deps);
    button(all, 'Stellar Testnet').onPress?.();
    expect(setExpanded).toHaveBeenCalledWith('stellar-testnet');
    expect(setPrompt).toHaveBeenCalledWith(testPrompt);
    expect(deps.probe).not.toHaveBeenCalled();
    all.find(node => node.type === AppModal)?.props.onRequestClose?.();
    expect(deps.onClose).toHaveBeenCalledTimes(1);
    expect(deps.save).not.toHaveBeenCalled();
  });
  it('fixes Work P2: retained Testnet falls back from a mode-hidden historical custom default consistently', async () => {
    const custom = 'https://testnet.example.org';
    const deps = setup({
      retainedTestnet: true,
      networkId: 'stellar-testnet',
      customNodes: { ...DEFAULT_NETWORK_PREFERENCES.customNodes, 'stellar-testnet': [custom] },
      endpoints: { ...DEFAULT_NETWORK_PREFERENCES.endpoints, 'stellar-testnet': custom },
    });
    await deps.settings.disableDeveloperMode();
    deps.save.mockClear();
    deps.restart.mockClear();
    deps.probe.mockClear();
    const { all, setPrompt } = render(deps, undefined, 'stellar-testnet');
    expect(button(all, 'Stellar Testnet')).toBeDefined();
    expect(button(all, NETWORKS['stellar-testnet'].horizonUrl)).toBeDefined();
    expect(all.some(node => node.props.accessibilityLabel?.includes(custom))).toBe(false);
    expect(all.some(node => node.type === Field)).toBe(false);
    button(all, 'Stellar Testnet').onPress?.();
    expect(setPrompt).toHaveBeenCalledWith(testPrompt);
    expect(deps.save).not.toHaveBeenCalled();
    expect(deps.settings.getSnapshot().preferences.endpoints['stellar-testnet']).toBe(custom);
    const dialog = render(deps, testPrompt).all;
    expect(dialog.some(node => node.props.children === testPrompt.endpoint)).toBe(true);
    await button(dialog, 'Confirm').onPress?.();
    expect(deps.probe).toHaveBeenCalledWith(testPrompt.endpoint, expect.any(AbortSignal));
    expect(deps.settings.getSnapshot().preferences).toMatchObject({
      developerMode: false,
      networkId: 'stellar-testnet',
      endpoints: { 'stellar-testnet': testPrompt.endpoint },
    });
  });
  it('cancels confirmation back to the panel without changing preferences or closing the chooser', () => {
    const deps = setup();
    const { all, setPrompt } = render(deps, testPrompt);
    expect(all.find(node => node.type === AppModal)?.props.presentation).toBe('dialog');
    button(all, 'Cancel').onPress?.();
    expect(setPrompt).toHaveBeenCalledWith(undefined);
    expect(deps.onClose).not.toHaveBeenCalled();
    expect(deps.save).not.toHaveBeenCalled();
  });
  it('keeps the old network on pending rejection and allows explicit retry', async () => {
    const guard = jest.fn((): void => {
      throw new Error('pending-submission');
    });
    const deps = setup({}, guard);
    const { all, setError } = render(deps, testPrompt);
    await button(all, 'Confirm').onPress?.();
    expect(setError).toHaveBeenLastCalledWith('networkManage.error.pending-submission');
    expect(deps.settings.getSnapshot().preferences.networkId).toBe('stellar-mainnet');
    guard.mockImplementation(() => {});
    await button(all, 'Confirm').onPress?.();
    expect(deps.restart).toHaveBeenCalledTimes(1);
  });
  it('cancels a busy probe and ignores its late result', async () => {
    const deps = setup();
    let resolve!: (value: string) => void;
    deps.probe.mockImplementationOnce(
      () =>
        new Promise<string>(done => {
          resolve = done;
        }),
    );
    const { all } = render(deps, testPrompt);
    const pending = button(all, 'Confirm').onPress?.();
    for (let i = 0; i < 6; i++) await Promise.resolve();
    // Native back sees the latest busy snapshot after rerender.
    const cancel = render(deps, testPrompt).all;
    button(cancel, 'Cancel').onPress?.();
    resolve(NETWORKS['stellar-testnet'].networkPassphrase);
    await pending;
    expect(deps.save).not.toHaveBeenCalled();
    expect(deps.restart).not.toHaveBeenCalled();
    expect(deps.onClose).toHaveBeenCalledTimes(1);
  });
  it('tests nodes without activating them and offers a custom-only delete confirmation', async () => {
    const custom = 'https://main.example.org';
    const deps = setup({ customNodes: { ...DEFAULT_NETWORK_PREFERENCES.customNodes, 'stellar-mainnet': [custom] } });
    const { all, setPrompt } = render(deps);
    await button(all, `Test node: ${custom}`).onPress?.();
    expect(deps.settings.getSnapshot().tests[JSON.stringify(['stellar-mainnet', custom])].status).toBe('reachable');
    expect(deps.save).not.toHaveBeenCalled();
    expect(deps.restart).not.toHaveBeenCalled();
    button(all, `Remove node: ${custom}`).onPress?.();
    expect(setPrompt).toHaveBeenCalledWith({ kind: 'remove', id: 'stellar-mainnet', endpoint: custom });
    const dialog = render(deps, { kind: 'remove', id: 'stellar-mainnet', endpoint: custom }).all;
    await button(dialog, 'Confirm').onPress?.();
    expect(deps.settings.getSnapshot().preferences.customNodes['stellar-mainnet']).toEqual([]);
    expect(deps.restart).not.toHaveBeenCalled();
  });
  it('validates and saves an inline endpoint, then offers use-now without silently activating', async () => {
    const custom = 'https://main.example.org';
    const deps = setup();
    const { all, setPrompt } = render(deps, undefined, 'stellar-mainnet', custom + '/');
    await button(all, 'Add node (Stellar Mainnet)').onPress?.();
    expect(deps.settings.getSnapshot().preferences.customNodes['stellar-mainnet']).toContain(custom);
    expect(deps.settings.getSnapshot().preferences.endpoints['stellar-mainnet']).toBe(
      NETWORKS['stellar-mainnet'].horizonUrl,
    );
    expect(deps.restart).not.toHaveBeenCalled();
    expect(setPrompt).toHaveBeenCalledWith({ kind: 'added', id: 'stellar-mainnet', endpoint: custom });
    const notNow = render(deps, { kind: 'added', id: 'stellar-mainnet', endpoint: custom });
    button(notNow.all, 'Not now').onPress?.();
    expect(notNow.setPrompt).toHaveBeenCalledWith(undefined);
    const useNow = render(deps, { kind: 'added', id: 'stellar-mainnet', endpoint: custom });
    await button(useNow.all, 'Use now').onPress?.();
    expect(deps.settings.getSnapshot().preferences.endpoints['stellar-mainnet']).toBe(custom);
    expect(deps.restart).toHaveBeenCalledTimes(1);
  });
  it('rejects wrong-network additions while retaining the input for retry', async () => {
    const deps = setup();
    deps.probe.mockResolvedValueOnce(NETWORKS['stellar-testnet'].networkPassphrase);
    const { all, setPrompt, setInput, setError } = render(
      deps,
      undefined,
      'stellar-mainnet',
      'https://wrong.example.org',
    );
    await button(all, 'Add node (Stellar Mainnet)').onPress?.();
    expect(setError).toHaveBeenLastCalledWith('networkManage.error.wrong-network');
    expect(setInput).not.toHaveBeenCalled();
    expect(setPrompt).not.toHaveBeenCalled();
    expect(deps.save).not.toHaveBeenCalled();
  });
});
