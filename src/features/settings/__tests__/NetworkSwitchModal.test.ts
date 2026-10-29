import React from 'react';
import { AppModal } from '@ui/components';
import { NativeButton } from '@ui/components/NativeButton';
import { createNetworkSettings } from '@capabilities/network/createNetworkSettings';
import { DEFAULT_NETWORK_PREFERENCES, NETWORKS } from '@capabilities/network/networkPreferences';
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
  useState: jest.fn((initial: unknown) => [initial, jest.fn()]),
  useRef: (initial: unknown) => ({ current: initial }),
  useEffect: jest.fn(),
  useCallback: (fn: unknown) => fn,
  useSyncExternalStore: (_subscribe: unknown, get: () => unknown) => get(),
}));
type Props = {
  children?: React.ReactNode;
  label?: string;
  onPress?: () => Promise<void> | void;
  onRequestClose?: () => void;
};
function nodes(root: React.ReactNode): React.ReactElement<Props>[] {
  if (!React.isValidElement<Props>(root)) return [];
  return [root, ...React.Children.toArray(root.props.children).flatMap(nodes)];
}
function setup(developerMode = true, assertCanSwitch = () => {}) {
  const save = jest.fn();
  const restart = jest.fn();
  const probe = jest.fn(async () => NETWORKS['stellar-testnet'].networkPassphrase as string);
  const settings = createNetworkSettings({
    initial: { ...DEFAULT_NETWORK_PREFERENCES, developerMode },
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
beforeEach(() => jest.clearAllMocks());
describe('Home network chooser', () => {
  it('uses mode visibility and waits for confirmation without selecting on entry', () => {
    const deps = setup(false);
    let all = nodes(NetworkSwitchModal(deps));
    expect(all.some(node => node.props.label?.includes('Stellar Testnet'))).toBe(false);
    expect(deps.save).not.toHaveBeenCalled();
    const allowed = setup();
    const setTarget = jest.fn();
    jest.mocked(React.useState).mockReturnValueOnce([undefined, setTarget]);
    all = nodes(NetworkSwitchModal(allowed));
    all.find(node => node.props.label === 'Stellar Testnet')?.props.onPress?.();
    expect(setTarget).toHaveBeenCalledWith('stellar-testnet');
    expect(allowed.probe).not.toHaveBeenCalled();
    all.find(node => node.type === AppModal)?.props.onRequestClose?.();
    expect(allowed.onClose).toHaveBeenCalledTimes(1);
    expect(allowed.save).not.toHaveBeenCalled();
  });
  it('confirms through the same verified Network capability and selected default endpoint', async () => {
    const deps = setup();
    jest.mocked(React.useState).mockReturnValueOnce(['stellar-testnet', jest.fn()]);
    const all = nodes(NetworkSwitchModal(deps));
    await all.find(node => node.type === NativeButton && node.props.label === 'Confirm')?.props.onPress?.();
    expect(deps.probe).toHaveBeenCalledWith(NETWORKS['stellar-testnet'].horizonUrl, expect.any(AbortSignal));
    expect(deps.save).toHaveBeenCalledWith(expect.objectContaining({ networkId: 'stellar-testnet' }));
    expect(deps.restart).toHaveBeenCalledTimes(1);
  });
  it('keeps the old network when pending transactions reject a change and allows retry', async () => {
    const guard = jest.fn((): void => {
      throw new Error('pending-submission');
    });
    const deps = setup(true, guard);
    const setError = jest.fn();
    jest
      .mocked(React.useState)
      .mockReturnValueOnce(['stellar-testnet', jest.fn()])
      .mockReturnValueOnce([undefined, setError]);
    const all = nodes(NetworkSwitchModal(deps));
    const confirm = all.find(node => node.type === NativeButton && node.props.label === 'Confirm')?.props.onPress;
    await confirm?.();
    expect(setError).toHaveBeenLastCalledWith('networkManage.error.pending-submission');
    expect(deps.settings.getSnapshot().preferences.networkId).toBe('stellar-mainnet');
    expect(deps.save).not.toHaveBeenCalled();
    guard.mockImplementation(() => {});
    await confirm?.();
    expect(deps.restart).toHaveBeenCalledTimes(1);
  });
  it('cancels a pending probe so a late response cannot commit a network change', async () => {
    const deps = setup();
    let resolve!: (value: string) => void;
    deps.probe.mockImplementationOnce(
      () =>
        new Promise<string>(done => {
          resolve = done;
        }),
    );
    jest.mocked(React.useState).mockReturnValueOnce(['stellar-testnet', jest.fn()]);
    const all = nodes(NetworkSwitchModal(deps));
    const promise = all.find(node => node.type === NativeButton && node.props.label === 'Confirm')?.props.onPress?.();
    for (let i = 0; i < 6; i++) await Promise.resolve();
    all.find(node => node.type === AppModal)?.props.onRequestClose?.();
    resolve(NETWORKS['stellar-testnet'].networkPassphrase);
    await promise;
    expect(deps.save).not.toHaveBeenCalled();
    expect(deps.restart).not.toHaveBeenCalled();
    expect(deps.onClose).toHaveBeenCalledTimes(1);
  });
});
