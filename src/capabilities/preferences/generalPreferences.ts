export type ThemeMode = 'light' | 'dark' | 'system' | 'image';
export type ImagePalette = Readonly<{ primary: string; secondary: string }>;
export type GeneralPreferences = Readonly<{
  theme: ThemeMode;
  imagePalette?: ImagePalette;
  currency: 'USD' | 'EUR' | 'CNY';
  haptics: boolean;
  systemSeparators: boolean;
  reserveDisplay: 'total' | 'spendable';
}>;
export const DEFAULT_GENERAL_PREFERENCES: GeneralPreferences = Object.freeze({
  theme: 'system',
  currency: 'USD',
  haptics: true,
  systemSeparators: true,
  reserveDisplay: 'spendable',
});
export interface GeneralPreferenceStore {
  load(): unknown;
  save(value: GeneralPreferences): void;
}
export type GeneralPreferenceController = ReturnType<typeof createGeneralPreferences>;
const hex = /^#[0-9a-f]{6}$/i;
export function validateGeneralPreferences(raw: unknown): GeneralPreferences {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('invalid-preferences');
  const value = raw as Record<string, unknown>;
  if (
    !['light', 'dark', 'system', 'image'].includes(String(value.theme)) ||
    !['USD', 'EUR', 'CNY'].includes(String(value.currency)) ||
    typeof value.haptics !== 'boolean' ||
    typeof value.systemSeparators !== 'boolean' ||
    !['total', 'spendable'].includes(String(value.reserveDisplay))
  )
    throw new Error('invalid-preferences');
  let imagePalette: ImagePalette | undefined;
  if (value.imagePalette !== undefined) {
    const palette = value.imagePalette as Record<string, unknown> | null;
    if (
      !palette ||
      typeof palette.primary !== 'string' ||
      !hex.test(palette.primary) ||
      typeof palette.secondary !== 'string' ||
      !hex.test(palette.secondary)
    )
      throw new Error('invalid-palette');
    imagePalette = Object.freeze({
      primary: palette.primary.toUpperCase(),
      secondary: palette.secondary.toUpperCase(),
    });
  }
  if (value.theme === 'image' && !imagePalette) throw new Error('image-palette-required');
  return Object.freeze({
    theme: value.theme as ThemeMode,
    currency: value.currency as GeneralPreferences['currency'],
    haptics: value.haptics,
    systemSeparators: value.systemSeparators,
    reserveDisplay: value.reserveDisplay as GeneralPreferences['reserveDisplay'],
    ...(imagePalette ? { imagePalette } : {}),
  });
}
export function paletteFromSamples(raw: unknown): ImagePalette {
  if (
    !Array.isArray(raw) ||
    !raw.length ||
    raw.length > 32 ||
    raw.some(color => typeof color !== 'string' || !hex.test(color))
  )
    throw new Error('invalid-palette-samples');
  const colors = raw as string[];
  const saturation = (color: string) => {
    const channels = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16));
    return Math.max(...channels) - Math.min(...channels);
  };
  const primary = [...colors].sort((a, b) => saturation(b) - saturation(a))[0]!;
  return Object.freeze({
    primary: primary.toUpperCase(),
    secondary: (colors.find(color => color.toUpperCase() !== primary.toUpperCase()) ?? primary).toUpperCase(),
  });
}
export function createGeneralPreferences(store: GeneralPreferenceStore, assertOpen: () => void = () => {}) {
  let closed = false;
  let snapshot = DEFAULT_GENERAL_PREFERENCES;
  try {
    const stored = store.load();
    if (stored !== undefined) snapshot = validateGeneralPreferences(stored);
  } catch {
    /* Invalid public preferences cannot block access to the wallet. */
  }
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    update(patch: Partial<GeneralPreferences>) {
      if (closed) throw new Error('preferences-retired');
      assertOpen();
      const next = validateGeneralPreferences({ ...snapshot, ...patch });
      store.save(next);
      snapshot = next;
      listeners.forEach(listener => listener());
    },
    close() {
      closed = true;
      listeners.clear();
    },
  };
}
