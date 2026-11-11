import { NativeModules, Platform } from 'react-native';
import { readNativePrivacyState, revealForegroundSurface } from '../privacyShield';

const modules = NativeModules as Record<string, unknown>;
const original = modules.PrivacyShield;
afterEach(() => {
  jest.restoreAllMocks();
  if (original === undefined) delete modules.PrivacyShield;
  else modules.PrivacyShield = original;
});
test('requires both native acknowledgement methods and validates the lifecycle counters', async () => {
  jest.replaceProperty(Platform, 'OS', 'ios');
  delete modules.PrivacyShield;
  await expect(readNativePrivacyState()).rejects.toThrow('privacy-shield-unavailable');
  for (const state of [{ generation: -1, backgroundCount: 0 }, { generation: 1, backgroundCount: 0.5 }, null]) {
    modules.PrivacyShield = { readState: async () => state, reveal: jest.fn() };
    await expect(readNativePrivacyState()).rejects.toThrow('invalid-privacy-state');
  }
});
test('passes the exact read generation to native and never treats a rejected acknowledgement as success', async () => {
  jest.replaceProperty(Platform, 'OS', 'ios');
  const reveal = jest.fn(async () => undefined);
  modules.PrivacyShield = { readState: async () => ({ generation: 7, backgroundCount: 2 }), reveal };
  const state = await readNativePrivacyState();
  await revealForegroundSurface(state!.generation);
  expect(reveal).toHaveBeenCalledWith(7);
  reveal.mockRejectedValueOnce(new Error('privacy-not-active'));
  await expect(revealForegroundSurface(7)).rejects.toThrow('privacy-not-active');
});
test('Android relies on its secure window and does not call the iOS bridge', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  const readState = jest.fn();
  modules.PrivacyShield = { readState, reveal: jest.fn() };
  await expect(readNativePrivacyState()).resolves.toBeUndefined();
  await revealForegroundSurface(0);
  expect(readState).not.toHaveBeenCalled();
});
