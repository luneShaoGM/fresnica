import React from 'react';
import { TextInput } from 'react-native';
import { Button } from '@ui/components';

jest.mock('@ui/components', () => ({ Screen: () => null, Button: () => null }));
jest.mock('../../../locale', () => ({ useLocalization: () => ({ t: (key: string) => key }) }));
jest.mock('@ui/theme', () => ({ useThemedStyles: () => ({}) }));
const react = jest.requireActual<typeof import('react')>('react');
const states: Array<{ current: unknown }> = [],
  refs: Array<{ current: unknown }> = [];
let si = 0,
  ri = 0;
const effects: React.EffectCallback[] = [];
jest.spyOn(react, 'useState').mockImplementation(((initial: unknown) => {
  const i = si++;
  if (!states[i]) states[i] = { current: initial };
  return [
    states[i].current,
    (value: unknown) => {
      states[i].current = value;
    },
  ];
}) as typeof react.useState);
jest.spyOn(react, 'useRef').mockImplementation(((initial: unknown) => {
  const i = ri++;
  if (!refs[i]) refs[i] = { current: initial };
  return refs[i];
}) as typeof react.useRef);
jest.spyOn(react, 'useEffect').mockImplementation((effect: React.EffectCallback) => {
  effects.push(effect);
});
const { SessionUnlockScreen } =
  require('../SessionUnlockScreen/SessionUnlockScreen') as typeof import('../SessionUnlockScreen/SessionUnlockScreen');
type Props = React.ComponentProps<typeof SessionUnlockScreen>;
type NodeProps = {
  children?: React.ReactNode;
  label?: string;
  onPress?: () => void;
  onChangeText?: (value: string) => void;
  disabled?: boolean;
  secureTextEntry?: boolean;
  value?: string;
};
function nodes(root: React.ReactNode): Array<React.ReactElement<NodeProps>> {
  if (!React.isValidElement<NodeProps>(root)) return [];
  const result = [root];
  React.Children.forEach(root.props.children, child => result.push(...nodes(child)));
  return result;
}
function render(props: Props) {
  si = 0;
  ri = 0;
  return SessionUnlockScreen(props);
}
function fixture(available = true) {
  return {
    unlock: jest.fn(async () => undefined),
    cancel: jest.fn(),
    canUseBiometrics: jest.fn(async () => available),
    unlockWithBiometrics: jest.fn(async () => undefined),
  };
}
beforeEach(() => {
  states.length = 0;
  refs.length = 0;
  effects.length = 0;
});
test('shows independent biometric access first and never passes a wallet credential to it', async () => {
  const f = fixture();
  render(f);
  effects.forEach(effect => effect());
  await Promise.resolve();
  await Promise.resolve();
  const tree = render(f),
    button = nodes(tree).find(n => n.type === Button && n.props.label === 'session.biometricUnlock');
  expect(button).toBeDefined();
  button!.props.onPress!();
  await Promise.resolve();
  expect(f.unlockWithBiometrics).toHaveBeenCalledWith('session.biometricReason', 'session.usePassphrase');
  expect(f.unlock).not.toHaveBeenCalled();
});
test('missing biometrics preserves secure passphrase fallback, consumed and cleared before verification', async () => {
  const f = fixture(false);
  render(f);
  effects.forEach(effect => effect());
  await Promise.resolve();
  await Promise.resolve();
  const clear = jest.fn();
  refs[1].current = { clear };
  const tree = render(f),
    all = nodes(tree);
  expect(all.some(n => n.props.label === 'session.biometricUnlock')).toBe(false);
  const input = all.find(n => n.type === TextInput)!;
  expect(input.props.secureTextEntry).toBe(true);
  expect(input.props.value).toBeUndefined();
  input.props.onChangeText!('private fixture phrase');
  all.find(n => n.type === Button && n.props.label === 'session.unlock')!.props.onPress!();
  expect(f.unlock).toHaveBeenCalledWith('private fixture phrase');
  expect(refs[0].current).toBe('');
  expect(clear).toHaveBeenCalled();
  expect(states.map(s => s.current)).not.toContain('private fixture phrase');
  expect(f.unlockWithBiometrics).not.toHaveBeenCalled();
});
test('rapid duplicate biometric presses invoke only one native attempt', async () => {
  const f = fixture();
  f.unlockWithBiometrics.mockImplementation(() => new Promise(() => {}));
  render(f);
  effects.forEach(effect => effect());
  await Promise.resolve();
  await Promise.resolve();
  const button = nodes(render(f)).find(n => n.props.label === 'session.biometricUnlock')!;
  button.props.onPress!();
  button.props.onPress!();
  expect(f.unlockWithBiometrics).toHaveBeenCalledTimes(1);
});
