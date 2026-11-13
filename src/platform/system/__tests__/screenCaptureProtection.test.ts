import { NativeModules, Platform } from 'react-native';
import { setScreenCaptureProtection } from '../screenCaptureProtection';
const modules = NativeModules as Record<string, unknown>;
const original = modules.ScreenCaptureProtection;
const platform = Object.getOwnPropertyDescriptor(Platform, 'OS');
afterEach(() => {
  if (original === undefined) delete modules.ScreenCaptureProtection;
  else modules.ScreenCaptureProtection = original;
  if (platform) Object.defineProperty(Platform, 'OS', platform);
});
it('requires an available Android bridge and strict acknowledgement for a policy change', async () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  delete modules.ScreenCaptureProtection;
  await expect(setScreenCaptureProtection(false)).rejects.toThrow();
  modules.ScreenCaptureProtection = { setProtected: async () => 'true' };
  await expect(setScreenCaptureProtection(false)).rejects.toThrow();
  const apply = jest.fn(async () => true);
  modules.ScreenCaptureProtection = { setProtected: apply };
  await setScreenCaptureProtection(true);
  expect(apply).toHaveBeenCalledWith(true);
});
it('does not invent iOS screenshot controls', async () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  delete modules.ScreenCaptureProtection;
  await expect(setScreenCaptureProtection(true)).resolves.toBeUndefined();
});
