jest.mock('@fresnica/ui-native', () => ({ Button: () => null }));
import React from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { SecuritySettingsScreen } from '../SecuritySettingsScreen';
import {
  DEFAULT_SECURITY_PREFERENCES,
  type SecuritySettings,
} from '@capabilities/application-security/securitySettings';
let mockRefs: Array<{ current: unknown }> = [];
let mockCleanup: (() => void) | undefined;
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useState: (initial: unknown) => [initial, jest.fn()],
  useRef: (initial: unknown) => {
    const ref = { current: initial };
    mockRefs.push(ref);
    return ref;
  },
  useSyncExternalStore: (_subscribe: unknown, get: () => unknown) => get(),
  useEffect: (effect: () => (() => void) | undefined) => {
    mockCleanup = effect();
  },
}));
jest.mock('@ui/components', () => ({ AppModal: () => null, Button: () => null, ListRow: () => null }));
jest.mock('@ui/components/PassphraseInput', () => ({ PassphraseInput: () => null }));
jest.mock('../../../locale', () => ({ useLocalization: () => ({ t: (key: string) => key }) }));
jest.mock('@ui/theme', () => {
  const actual = jest.requireActual('@ui/theme');
  return { ...actual, useThemedStyles: (factory: (theme: unknown) => unknown) => factory(actual.defaultTheme) };
});
it.each(['inactive', 'unmount'] as const)(
  'clears transient credentials and cancels an outstanding save on %s',
  async reason => {
    mockRefs = [];
    let lifecycle!: (state: AppStateStatus) => void;
    const subscription = jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
      lifecycle = listener;
      return { remove: jest.fn() };
    });
    let finish!: () => void;
    const update = jest.fn(
      () =>
        new Promise<void>(resolve => {
          finish = resolve;
        }),
    );
    const settings = {
      subscribe: jest.fn(),
      getSnapshot: () => DEFAULT_SECURITY_PREFERENCES,
      requiresPassphrase: () => true,
      update,
    } as unknown as SecuritySettings;
    const root = SecuritySettingsScreen({ onClose: jest.fn(), settings, active: true });
    const input = { consume: jest.fn(() => 'transient-test-credential'), clear: jest.fn() };
    mockRefs[0].current = input;
    let save!: () => Promise<void>;
    const visit = (node: React.ReactNode) => {
      if (!React.isValidElement<{ label?: string; onPress?: () => Promise<void>; children?: React.ReactNode }>(node))
        return;
      if (node.props.label === 'security.settings.save') save = node.props.onPress!;
      React.Children.forEach(node.props.children, visit);
    };
    visit(root);
    const pending = save();
    const signal = jest.mocked(settings.update).mock.calls[0][2];
    expect(input.consume).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(root)).not.toContain('transient-test-credential');
    if (reason === 'inactive') lifecycle('inactive');
    else mockCleanup?.();
    expect(signal.aborted).toBe(true);
    expect(input.clear).toHaveBeenCalled();
    finish();
    await pending;
    mockCleanup?.();
    subscription.mockRestore();
  },
);
