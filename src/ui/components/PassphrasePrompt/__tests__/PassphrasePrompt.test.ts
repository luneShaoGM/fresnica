import React from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { PassphrasePrompt } from '../PassphrasePrompt';
import { PassphraseInput } from '../../PassphraseInput';
import { Button } from '../../Button';
import { AppModal } from '../../AppModal';
let mockCleanup: (() => void) | undefined;
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useRef: (current: unknown) => ({ current }),
  useEffect: (fn: () => (() => void) | undefined) => {
    mockCleanup = fn();
  },
}));
jest.mock('../../../theme', () => {
  const actual = jest.requireActual('../../../theme');
  return { ...actual, useThemedStyles: (factory: (theme: unknown) => unknown) => factory(actual.defaultTheme) };
});
function fixture(overrides: Partial<Parameters<typeof PassphrasePrompt>[0]> = {}) {
  let lifecycle!: (state: AppStateStatus) => void;
  const remove = jest.fn();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, fn) => {
    lifecycle = fn;
    return { remove };
  });
  const props = {
    visible: true,
    busy: false,
    title: 'Sign',
    label: 'Password',
    hint: 'Fresh password',
    confirmLabel: 'Confirm and sign',
    cancelLabel: 'Cancel',
    inputRef: { current: { consume: jest.fn(), clear: jest.fn() } },
    hasValue: false,
    onPresenceChange: jest.fn(),
    onConfirm: jest.fn(),
    onCancel: jest.fn(),
    onExpire: jest.fn(),
    ...overrides,
  };
  const root = PassphrasePrompt(props);
  const nodes: React.ReactElement<Record<string, unknown>>[] = [];
  const visit = (node: React.ReactNode) => {
    if (!React.isValidElement<Record<string, unknown>>(node)) return;
    nodes.push(node);
    React.Children.forEach(node.props.children as React.ReactNode, visit);
  };
  visit(root);
  return { props, root, nodes, lifecycle: (state: AppStateStatus) => lifecycle(state), remove };
}
beforeEach(() => {
  AppState.currentState = 'active';
  jest.useFakeTimers();
  mockCleanup = undefined;
});
afterEach(() => {
  mockCleanup?.();
  jest.useRealTimers();
  jest.restoreAllMocks();
});
it('renders an autofocus uncontrolled input only when visible and gates signing on presence', () => {
  const h = fixture();
  const field = h.nodes.find(node => node.type === PassphraseInput)!;
  expect(field.props.autoFocus).toBe(true);
  expect(field.props.value).toBeUndefined();
  const sign = h.nodes.find(node => node.type === Button && node.props.label === 'Confirm and sign')!;
  expect(sign.props.disabled).toBe(true);
  expect(h.props.onConfirm).not.toHaveBeenCalled();
});
it('hides the prompt when closed or inactive and never signs from dismissal', () => {
  expect(fixture({ visible: false }).root).toBeNull();
  const h = fixture({ active: false });
  expect(h.root).toBeNull();
  expect(h.props.onCancel).toHaveBeenCalledTimes(1);
  expect(h.props.onConfirm).not.toHaveBeenCalled();
});
it('clears and closes on background and cannot resume authentication on foreground', () => {
  const h = fixture();
  h.lifecycle('inactive');
  h.lifecycle('active');
  expect(h.props.inputRef.current?.clear).toHaveBeenCalledTimes(1);
  expect(h.props.onCancel).toHaveBeenCalledTimes(1);
  expect(h.props.onConfirm).not.toHaveBeenCalled();
});
it('retires an expired review instead of retaining a usable credential', () => {
  const h = fixture({ expiresAtUnixMs: Date.now() + 1000 });
  jest.advanceTimersByTime(1000);
  expect(h.props.inputRef.current?.clear).toHaveBeenCalled();
  expect(h.props.onExpire).toHaveBeenCalledTimes(1);
  expect(h.props.onConfirm).not.toHaveBeenCalled();
});
it('keeps errors inside the prompt and prevents dismissing an ongoing signature', () => {
  const h = fixture({ busy: true, hasValue: true, error: 'Incorrect passphrase' });
  expect(h.nodes.some(node => node.props.children === 'Incorrect passphrase')).toBe(true);
  const modal = h.nodes.find(node => node.type === AppModal)!;
  (modal.props.onRequestClose as () => void)();
  expect(h.props.onCancel).not.toHaveBeenCalled();
  expect(h.nodes.filter(node => node.type === Button).every(node => node.props.disabled)).toBe(true);
});
it('removes listeners, cancels the expiry timer and clears credentials on unmount', () => {
  const h = fixture({ expiresAtUnixMs: Date.now() + 1000 });
  mockCleanup?.();
  mockCleanup = undefined;
  jest.advanceTimersByTime(1000);
  expect(h.remove).toHaveBeenCalledTimes(1);
  expect(h.props.inputRef.current?.clear).toHaveBeenCalledTimes(1);
  expect(h.props.onExpire).not.toHaveBeenCalled();
});
