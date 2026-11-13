import { authorizeSensitiveSetting } from './authorizeSensitiveSetting';
import {
  requiresExistingAppPassphrase,
  type ExistingAppPassphraseVerificationDependencies,
} from './verifyExistingAppPassphrase';

export type SecurityPreferences = Readonly<{
  biometricUnlock: boolean;
  backgroundTimeoutMs: 0 | 30000 | 60000 | 300000;
  screenCaptureProtection: boolean;
}>;
export const DEFAULT_SECURITY_PREFERENCES: SecurityPreferences = Object.freeze({
  biometricUnlock: true,
  backgroundTimeoutMs: 30000,
  screenCaptureProtection: true,
});
export function validateSecurityPreferences(raw: unknown): SecurityPreferences {
  if (!raw || typeof raw !== 'object') throw new Error('invalid-security-preferences');
  const value = raw as Record<string, unknown>;
  if (
    typeof value.biometricUnlock !== 'boolean' ||
    typeof value.screenCaptureProtection !== 'boolean' ||
    ![0, 30000, 60000, 300000].includes(value.backgroundTimeoutMs as number)
  )
    throw new Error('invalid-security-preferences');
  return Object.freeze({
    biometricUnlock: value.biometricUnlock,
    backgroundTimeoutMs: value.backgroundTimeoutMs as SecurityPreferences['backgroundTimeoutMs'],
    screenCaptureProtection: value.screenCaptureProtection,
  });
}
export function createSecuritySettings(
  deps: ExistingAppPassphraseVerificationDependencies &
    Readonly<{
      store: { load(): unknown; save(value: SecurityPreferences): void };
      assertOpen(): void;
      getAccess(): Readonly<{ foreground: boolean; locked: boolean }>;
      developerMode(): boolean;
      applyScreenProtection(required: boolean): Promise<void>;
    }>,
) {
  let snapshot = DEFAULT_SECURITY_PREFERENCES;
  try {
    const saved = deps.store.load();
    if (saved !== undefined) snapshot = validateSecurityPreferences(saved);
  } catch {
    /* Invalid settings retain protection. */
  }
  const listeners = new Set<() => void>();
  let closed = false,
    busy = false;
  const check = (signal: AbortSignal) => {
    deps.assertOpen();
    const access = deps.getAccess();
    if (closed || signal.aborted || !access.foreground || access.locked) throw new Error('security-setting-retired');
  };
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    requiresPassphrase: () => requiresExistingAppPassphrase(deps.repository),
    async update(patch: Partial<SecurityPreferences>, passphrase: string, signal: AbortSignal) {
      check(signal);
      if (busy) throw new Error('security-setting-busy');
      busy = true;
      try {
        const next = validateSecurityPreferences({ ...snapshot, ...patch });
        if (requiresExistingAppPassphrase(deps.repository)) await authorizeSensitiveSetting(deps, passphrase, signal);
        check(signal);
        if (patch.screenCaptureProtection === false && !deps.developerMode())
          throw new Error('developer-mode-required');
        await deps.applyScreenProtection(next.screenCaptureProtection || !deps.developerMode());
        check(signal);
        if (patch.screenCaptureProtection === false && !deps.developerMode())
          throw new Error('developer-mode-required');
        deps.store.save(next);
        snapshot = next;
        listeners.forEach(listener => listener());
      } catch (error) {
        await deps.applyScreenProtection(true).catch(() => undefined);
        throw error;
      } finally {
        busy = false;
      }
    },
    close() {
      closed = true;
      listeners.clear();
    },
  };
}
export type SecuritySettings = ReturnType<typeof createSecuritySettings>;
