import type { SessionAuthenticationPort } from '../capabilities/ports/SessionAuthenticationPort';
import { authorizeSensitiveSetting } from '../capabilities/application-security/authorizeSensitiveSetting';
import type { ExistingAppPassphraseVerificationDependencies } from '../capabilities/application-security/verifyExistingAppPassphrase';
import { requiresExistingAppPassphrase } from '../capabilities/application-security/verifyExistingAppPassphrase';
import {
  createSessionLockState,
  recordSessionBackground,
  resumeSession,
  markSessionLocked,
  completeVerifiedSessionUnlock,
} from './sessionLockState';

type SessionRepository = ExistingAppPassphraseVerificationDependencies['repository'];
export type NetworkAccessContinuation = Readonly<{
  resume: (repository: SessionRepository) => number | undefined;
  cancel: () => void;
  isValid: () => boolean;
}>;

const policy = { enabled: true, backgroundTimeoutMs: 30_000 } as const;
export type ApplicationSessionSnapshot = Readonly<{
  locked: boolean;
  foreground: boolean;
  revision: number;
  canLock: boolean;
  backgroundRevision: number;
}>;

// App access is distinct from signing authorization. No credential or auth token is retained.
export function createApplicationSession(
  deps: ExistingAppPassphraseVerificationDependencies & { sessionAuthentication?: SessionAuthenticationPort },
  now: () => number = () => performance.now(),
  continuation?: NetworkAccessContinuation,
) {
  let state = createSessionLockState({ ...policy, enabled: requiresExistingAppPassphrase(deps.repository) });
  const continuedBackgroundRevision = continuation?.resume(deps.repository);
  if (continuedBackgroundRevision !== undefined) state = completeVerifiedSessionUnlock();
  let foreground = false;
  let revision = 0;
  // Keep native privacy acknowledgements aligned across network generations.
  let backgroundRevision = continuedBackgroundRevision ?? 0;
  let closed = false;
  let active: AbortController | undefined;
  let snapshot: ApplicationSessionSnapshot;
  const listeners = new Set<() => void>();
  const publish = () => {
    snapshot = Object.freeze({
      locked: state.status === 'locked',
      foreground,
      revision,
      backgroundRevision,
      canLock: requiresExistingAppPassphrase(deps.repository),
    });
    listeners.forEach(listener => listener());
  };
  const interrupt = () => {
    revision += 1;
    deps.sessionAuthentication?.cancel();
    active?.abort();
    active = undefined;
  };
  publish();
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setForeground(value: boolean) {
      if (closed) return;
      if (foreground === value) {
        if (value) publish();
        return;
      }
      foreground = value;
      if (!value) {
        backgroundRevision += 1;
        interrupt();
        state = recordSessionBackground(state, now());
      } else
        state = resumeSession(state, { ...policy, enabled: requiresExistingAppPassphrase(deps.repository) }, now());
      publish();
    },
    retireMissedBackground() {
      if (closed) return;
      interrupt();
      backgroundRevision += 1;
      if (requiresExistingAppPassphrase(deps.repository)) state = markSessionLocked('background-timeout');
      publish();
    },
    refreshInventory() {
      if (closed) return;
      publish();
    },
    lock() {
      if (closed || !requiresExistingAppPassphrase(deps.repository)) return;
      interrupt();
      state = markSessionLocked();
      publish();
    },
    continueAcrossNetworkChange(): NetworkAccessContinuation | undefined {
      if (closed || !foreground || active || state.status !== 'unlocked') return undefined;
      const inventory = JSON.stringify(deps.repository.listSigners());
      const started = now();
      const continuedRevision = backgroundRevision;
      let available = true;
      let cancelled = false;
      const isValid = () => !cancelled && now() - started < policy.backgroundTimeoutMs;
      // Browsing access survives one immediate rebuild; credentials and signing authority never transfer.
      return {
        resume(repository) {
          const allowed = available;
          available = false;
          return allowed && isValid() && JSON.stringify(repository.listSigners()) === inventory
            ? continuedRevision
            : undefined;
        },
        cancel() {
          cancelled = true;
        },
        isValid,
      };
    },
    canUseBiometrics: () => deps.sessionAuthentication?.canAuthenticate() ?? Promise.resolve(false),
    async unlockWithBiometrics(reason: string, cancelLabel: string) {
      if (closed || !foreground || active || state.status !== 'locked' || !deps.sessionAuthentication)
        throw new Error('session-unlock-unavailable');
      const owner = new AbortController();
      const inventory = () => JSON.stringify(deps.repository.listSigners());
      const before = inventory();
      active = owner;
      try {
        const verified = await deps.sessionAuthentication.authenticate(reason, cancelLabel);
        if (
          verified !== true ||
          closed ||
          !foreground ||
          owner.signal.aborted ||
          active !== owner ||
          inventory() !== before ||
          !requiresExistingAppPassphrase(deps.repository)
        )
          throw new Error('session-auth-failed');
        state = completeVerifiedSessionUnlock();
        revision += 1;
        publish();
      } finally {
        if (active === owner) active = undefined;
      }
    },
    async unlock(passphrase: string) {
      if (closed || !foreground || active || state.status !== 'locked') throw new Error('session-unlock-unavailable');
      const owner = new AbortController();
      active = owner;
      try {
        await authorizeSensitiveSetting(deps, passphrase, owner.signal);
        if (closed || !foreground || owner.signal.aborted || active !== owner) throw new Error('session-retired');
        state = completeVerifiedSessionUnlock();
        revision += 1;
        publish();
      } finally {
        if (active === owner) active = undefined;
      }
    },
    cancelUnlock() {
      deps.sessionAuthentication?.cancel();
      active?.abort();
      active = undefined;
    },
    bindSensitive<T extends object>(target: T, expectedRevision?: number): T {
      return new Proxy(target, {
        get(object, key) {
          const value: unknown = Reflect.get(object, key);
          if (typeof value !== 'function') return value;
          return (...args: unknown[]) => {
            if (closed || !foreground || state.status === 'locked') throw new Error('application-session-locked');
            if (expectedRevision !== undefined && expectedRevision !== revision) throw new Error('session-retired');
            const started = revision;
            const result: unknown = Reflect.apply(value, object, args);
            if (result instanceof Promise)
              return result.then(output => {
                if (closed || !foreground || state.status === 'locked' || started !== revision)
                  throw new Error('session-retired');
                return output;
              });
            return result;
          };
        },
      });
    },
    close() {
      closed = true;
      interrupt();
      listeners.clear();
    },
  };
}
export type ApplicationSession = ReturnType<typeof createApplicationSession>;
