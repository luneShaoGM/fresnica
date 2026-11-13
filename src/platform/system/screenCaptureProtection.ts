import { NativeModules, Platform } from 'react-native';
export async function setScreenCaptureProtection(required: boolean): Promise<void> {
  if (Platform.OS !== 'android') return;
  const native = NativeModules.ScreenCaptureProtection as
    { setProtected?(required: boolean): Promise<boolean> } | undefined;
  if (!native?.setProtected || (await native.setProtected(required)) !== true)
    throw new Error('screen-protection-unavailable');
}
