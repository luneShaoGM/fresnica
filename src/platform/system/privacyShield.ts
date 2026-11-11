import { NativeModules, Platform } from 'react-native';

export type NativePrivacyState = Readonly<{ generation: number; backgroundCount: number }>;
function nativeShield() {
  const shield = NativeModules.PrivacyShield as
    | {
        readState?: () => Promise<NativePrivacyState>;
        reveal?: (generation: number) => Promise<void>;
      }
    | undefined;
  if (!shield?.readState || !shield.reveal) throw new Error('privacy-shield-unavailable');
  return { readState: shield.readState, reveal: shield.reveal };
}
export async function readNativePrivacyState(): Promise<NativePrivacyState | undefined> {
  if (Platform.OS !== 'ios') return undefined;
  const state = await nativeShield().readState();
  if (
    !Number.isSafeInteger(state?.generation) ||
    state.generation < 0 ||
    !Number.isSafeInteger(state?.backgroundCount) ||
    state.backgroundCount < 0
  )
    throw new Error('invalid-privacy-state');
  return state;
}
// Native checks this generation again on the UI queue; a stale acknowledgement cannot uncover a newer background.
export async function revealForegroundSurface(generation: number): Promise<void> {
  if (Platform.OS === 'ios') await nativeShield().reveal(generation);
}
