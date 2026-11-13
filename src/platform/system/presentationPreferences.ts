import { NativeModules } from 'react-native';
import { paletteFromSamples, type ImagePalette } from '@capabilities/preferences/generalPreferences';
type PresentationModule = { pickPalette?: () => Promise<unknown>; impact?: () => void; cancelPalette?: () => void };
export async function pickImagePalette(): Promise<ImagePalette | undefined> {
  const native = NativeModules.PresentationPreferences as PresentationModule | undefined;
  if (!native?.pickPalette) throw new Error('image-palette-unavailable');
  const value = await native.pickPalette();
  if (value === null) return undefined;
  return paletteFromSamples(value);
}
export function presentationFeedback(): void {
  try {
    (NativeModules.PresentationPreferences as PresentationModule | undefined)?.impact?.();
  } catch {
    /* Feedback cannot block an operation. */
  }
}

export function cancelImagePalette(): void {
  (NativeModules.PresentationPreferences as PresentationModule | undefined)?.cancelPalette?.();
}
