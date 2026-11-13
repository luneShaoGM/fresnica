import type { GeneralPreferenceController, ImagePalette } from '@capabilities/preferences/generalPreferences';

export type ThemeImageSelectionSnapshot = Readonly<{ busy: boolean; error: boolean }>;
const idle: ThemeImageSelectionSnapshot = Object.freeze({ busy: false, error: false });

// Only a bounded public palette survives the system Activity, never wallet access or credentials.
export function createThemeImageSelection(
  deps: Readonly<{
    preferences: GeneralPreferenceController;
    pickPalette(): Promise<ImagePalette | undefined>;
    cancelPalette(): void;
    getAccess(): Readonly<{ foreground: boolean; locked: boolean }>;
    subscribeAccess(listener: () => void): () => void;
    assertOpen(): void;
  }>,
) {
  let snapshot = idle;
  let generation = 0;
  let closed = false;
  let pending: { palette: ImagePalette; expected: ReturnType<GeneralPreferenceController['getSnapshot']> } | undefined;
  const listeners = new Set<() => void>();
  const publish = (next: ThemeImageSelectionSnapshot) => {
    snapshot = next;
    listeners.forEach(listener => listener());
  };
  const flush = () => {
    if (closed || !pending) return;
    const access = deps.getAccess();
    if (!access.foreground || access.locked) return;
    const result = pending;
    pending = undefined;
    try {
      deps.assertOpen();
      if (deps.preferences.getSnapshot() !== result.expected) {
        publish(idle);
        return;
      }
      deps.preferences.update({ theme: 'image', imagePalette: result.palette });
      publish(idle);
    } catch {
      publish({ busy: false, error: true });
    }
  };
  const unsubscribe = deps.subscribeAccess(flush);
  const cancel = () => {
    generation += 1;
    pending = undefined;
    deps.cancelPalette();
    publish(idle);
  };
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async start() {
      if (closed || snapshot.busy) return;
      const access = deps.getAccess();
      if (!access.foreground || access.locked) return;
      const epoch = ++generation;
      const expected = deps.preferences.getSnapshot();
      publish({ busy: true, error: false });
      try {
        deps.assertOpen();
        const palette = await deps.pickPalette();
        if (closed || epoch !== generation) return;
        if (!palette) {
          publish(idle);
          return;
        }
        pending = { palette, expected };
        flush();
      } catch {
        if (!closed && epoch === generation) publish({ busy: false, error: true });
      }
    },
    cancel,
    close() {
      if (closed) return;
      closed = true;
      unsubscribe();
      cancel();
      listeners.clear();
    },
  };
}
export type ThemeImageSelection = ReturnType<typeof createThemeImageSelection>;
