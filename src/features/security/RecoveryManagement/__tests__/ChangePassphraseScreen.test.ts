import React from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import {
  changeWalletPassphrase,
  type RecoveryManagementDependencies,
} from '@capabilities/application-security/recoveryManagement';

jest.mock('@capabilities/application-security/recoveryManagement', () => ({ changeWalletPassphrase: jest.fn() }));
jest.mock('@ui/components', () => ({ Screen: () => null, Button: () => null }));
jest.mock('@ui/components/PassphraseInput', () => ({ PassphraseInput: () => null }));
jest.mock('../../../../locale', () => ({ useLocalization: () => ({ t: (key: string) => key }) }));
jest.mock('@ui/theme', () => {
  const actual = jest.requireActual('@ui/theme');
  return { ...actual, useThemedStyles: (factory: (theme: unknown) => unknown) => factory(actual.defaultTheme) };
});
const states: unknown[] = [],
  refs: Array<{ current: unknown }> = [];
let si = 0,
  ri = 0,
  installed = false;
let cleanup: (() => void) | undefined;
jest.spyOn(React, 'useState').mockImplementation(((initial: unknown) => {
  const i = si++;
  if (!(i in states)) states[i] = initial;
  return [
    states[i],
    (value: unknown) => {
      states[i] = typeof value === 'function' ? (value as (old: unknown) => unknown)(states[i]) : value;
    },
  ];
}) as typeof React.useState);
jest.spyOn(React, 'useRef').mockImplementation(((initial: unknown) => {
  const i = ri++;
  return refs[i] ?? (refs[i] = { current: initial });
}) as typeof React.useRef);
jest.spyOn(React, 'useEffect').mockImplementation(effect => {
  if (!installed) {
    installed = true;
    cleanup = effect() || undefined;
  }
});
const { ChangePassphraseScreen } = require('../ChangePassphraseScreen') as typeof import('../ChangePassphraseScreen');
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => {
    resolve = r;
  });
  return { resolve, promise };
}
function fixture() {
  let lifecycle!: (state: AppStateStatus) => void;
  const subscription = jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
    lifecycle = listener;
    return { remove: jest.fn() };
  });
  const onChanged = jest.fn();
  const dependencies = {} as RecoveryManagementDependencies;
  type Props = {
    label?: string;
    disabled?: boolean;
    onPress?: () => Promise<void>;
    onPresenceChange?: (v: boolean) => void;
    children?: React.ReactNode;
  };
  const render = () => {
    si = ri = 0;
    const root = ChangePassphraseScreen({ active: true, dependencies, onChanged, onBack: jest.fn() });
    const nodes: Props[] = [];
    const visit = (node: React.ReactNode) => {
      if (!React.isValidElement<Props>(node)) return;
      nodes.push(node.props);
      React.Children.forEach(node.props.children, visit);
    };
    visit(root);
    return {
      fields: nodes.filter(p => p.onPresenceChange),
      change: nodes.find(p => p.onPress && p.label === 'recovery.change')!,
    };
  };
  render();
  const inputs = [0, 1, 2].map(i => {
    const input = { clear: jest.fn(), consume: jest.fn(() => 'fixture-passphrase') };
    refs[i].current = input;
    return input;
  });
  return {
    render,
    inputs,
    onChanged,
    lifecycle: (state: AppStateStatus) => lifecycle(state),
    close: () => {
      cleanup?.();
      subscription.mockRestore();
    },
  };
}
beforeEach(() => {
  states.length = refs.length = 0;
  installed = false;
  cleanup = undefined;
  jest.mocked(changeWalletPassphrase).mockReset();
});
it.each([false, true])(
  'inactive cancellation releases retained inputs and isolates old settlement (settles during retry=%s)',
  async duringRetry => {
    const first = deferred(),
      second = deferred();
    jest.mocked(changeWalletPassphrase).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const h = fixture();
    try {
      h.render().fields.forEach(field => field.onPresenceChange!(true));
      const oldRequest = h.render().change.onPress!();
      expect(h.render().fields.every(field => field.disabled)).toBe(true);
      const signal = jest.mocked(changeWalletPassphrase).mock.calls[0][1].signal!;
      h.lifecycle('inactive');
      expect(signal.aborted).toBe(true);
      expect(h.render().fields.every(field => !field.disabled)).toBe(true);
      expect(h.render().change.disabled).toBe(true);
      h.inputs.forEach(input => expect(input.clear).toHaveBeenCalled());
      if (!duringRetry) {
        first.resolve();
        await oldRequest;
      }
      h.lifecycle('active');
      h.render().fields.forEach(field => field.onPresenceChange!(true));
      expect(h.render().change.disabled).toBe(false);
      const retry = h.render().change.onPress!();
      if (duringRetry) {
        first.resolve();
        await oldRequest;
      }
      expect(h.onChanged).not.toHaveBeenCalled();
      expect(h.render().fields.every(field => field.disabled)).toBe(true);
      second.resolve();
      await retry;
      expect(h.onChanged).toHaveBeenCalledTimes(1);
      expect(h.render().fields.every(field => !field.disabled)).toBe(true);
    } finally {
      h.close();
    }
  },
);
