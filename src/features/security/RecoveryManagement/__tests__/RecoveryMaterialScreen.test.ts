import React from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { RecoveryMaterialScreen } from '../RecoveryMaterialScreen';
import {
  revealRecoveryMaterial,
  type RecoveryManagementDependencies,
} from '@capabilities/application-security/recoveryManagement';
let mockRefs: { current: unknown }[] = [];
let mockEffect: (() => (() => void) | undefined) | undefined;
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useRef: (initial: unknown) => {
    const ref = { current: initial };
    mockRefs.push(ref);
    return ref;
  },
  useState: (initial: unknown) => [initial, jest.fn()],
  useCallback: (callback: unknown) => callback,
  useEffect: (effect: () => (() => void) | undefined) => {
    mockEffect = effect;
  },
}));
jest.mock('@ui/components', () => ({ Screen: () => null, Button: () => null }));
jest.mock('@ui/theme', () => {
  const actual = jest.requireActual('@ui/theme');
  return { ...actual, useThemedStyles: (factory: (theme: unknown) => unknown) => factory(actual.defaultTheme) };
});
jest.mock('../../../../locale', () => ({ useLocalization: () => ({ t: (key: string) => key }) }));
jest.mock('@capabilities/application-security/recoveryManagement', () => ({
  recoverySigners: () => [{ id: 'signer' }],
  revealRecoveryMaterial: jest.fn(),
}));
function setup() {
  mockRefs = [];
  const output = { clear: jest.fn(), setNativeProps: jest.fn() };
  const input = { consume: jest.fn(() => 'fresh-passphrase'), clear: jest.fn() };
  const clipboard = { copy: jest.fn(async () => undefined), clear: jest.fn() };
  const root = RecoveryMaterialScreen({
    dependencies: {} as RecoveryManagementDependencies,
    accountId: 'a',
    active: true,
    clipboard,
    onBack: jest.fn(),
  });
  mockRefs[0].current = input;
  mockRefs[1].current = output;
  const cleanup = mockEffect?.();
  let show: (() => Promise<void>) | undefined;
  function visit(node: React.ReactNode) {
    if (!React.isValidElement<{ label?: string; onPress?: () => Promise<void>; children?: React.ReactNode }>(node))
      return;
    if (node.props.label === 'recovery.reveal') show = node.props.onPress;
    React.Children.forEach(node.props.children, visit);
  }
  visit(root);
  return { root, output, input, clipboard, show: show!, cleanup };
}
beforeEach(() => {
  jest.useFakeTimers();
  (revealRecoveryMaterial as jest.Mock).mockReset();
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});
it('presents transient output outside React props and destroys it at the 60-second deadline', async () => {
  (revealRecoveryMaterial as jest.Mock).mockResolvedValue({ kind: 'mnemonic', mnemonic: 'private recovery words' });
  const h = setup();
  await h.show();
  expect(h.output.setNativeProps).toHaveBeenCalledWith({ text: 'private recovery words' });
  expect(JSON.stringify(h.root)).not.toContain('private recovery words');
  jest.advanceTimersByTime(60_000);
  expect(mockRefs[2].current).toBe('');
  expect(h.output.clear).toHaveBeenCalled();
  expect(h.clipboard.clear).toHaveBeenCalled();
  h.cleanup?.();
});
it('drops late reveal completion after leaving the screen', async () => {
  let finish: (value: unknown) => void = () => undefined;
  (revealRecoveryMaterial as jest.Mock).mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  const h = setup();
  const pending = h.show();
  h.cleanup?.();
  finish({ kind: 'secret', secret: 'private-secret' });
  await pending;
  expect(h.output.setNativeProps).not.toHaveBeenCalled();
  expect(mockRefs[2].current).toBe('');
});
it('clears plaintext and clipboard immediately on inactive/background', async () => {
  let change: (next: AppStateStatus) => void = () => undefined;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
    change = listener;
    return { remove: jest.fn() };
  });
  (revealRecoveryMaterial as jest.Mock).mockResolvedValue({ kind: 'secret', secret: 'private-secret' });
  const h = setup();
  await h.show();
  change('inactive');
  expect(mockRefs[2].current).toBe('');
  expect(h.output.clear).toHaveBeenCalled();
  expect(h.clipboard.clear).toHaveBeenCalled();
  h.cleanup?.();
});
