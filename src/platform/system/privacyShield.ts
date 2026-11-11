import { NativeModules, Platform } from 'react-native';

// Native iOS cover stays up until React has committed its safe foreground surface.
export async function revealForegroundSurface(): Promise<void> {
  if (Platform.OS !== 'ios') return;
  const shield = NativeModules.PrivacyShield as { reveal?: () => Promise<void> } | undefined;
  if (!shield?.reveal) throw new Error('privacy-shield-unavailable');
  await shield.reveal();
}
