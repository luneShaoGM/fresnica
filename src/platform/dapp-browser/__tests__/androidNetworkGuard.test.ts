import { NativeModules, Platform } from 'react-native';

import { prepareDappNetworkGuard } from '../androidNetworkGuard';

const originalOS = Platform.OS;
const originalGuard = NativeModules.DappNetworkGuard;
afterEach(() => {
  Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
  NativeModules.DappNetworkGuard = originalGuard;
  jest.useRealTimers();
});

test('fails closed when native proxy installation never acknowledges', async () => {
  jest.useFakeTimers();
  Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
  NativeModules.DappNetworkGuard = { available: true, prepare: () => new Promise(() => undefined) };
  const pending = expect(prepareDappNetworkGuard()).rejects.toThrow('dapp-guard-timeout');
  await jest.advanceTimersByTimeAsync(10000);
  await pending;
  expect(jest.getTimerCount()).toBe(0);
});

test('missing native support rejects instead of permitting an unprotected browser', async () => {
  Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
  NativeModules.DappNetworkGuard = undefined;
  await expect(prepareDappNetworkGuard()).rejects.toThrow('dapp-guard-unavailable');
});

test('iOS uses its existing transport without configuring an Android proxy', async () => {
  Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
  const prepare = jest.fn();
  NativeModules.DappNetworkGuard = { available: true, prepare };
  await prepareDappNetworkGuard();
  expect(prepare).not.toHaveBeenCalled();
});
