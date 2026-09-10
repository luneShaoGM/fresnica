import {
  cancelSessionUnlock,
  completeVerifiedSessionUnlock,
  createSessionLockState,
  markSessionLocked,
  recordSessionBackground,
  resumeSession,
} from '../sessionLockState';

const enabledPolicy = {enabled: true, backgroundTimeoutMs: 30_000} as const;

describe('session lock state', () => {
  it('starts locked on cold start when app lock is enabled', () => {
    expect(createSessionLockState(enabledPolicy)).toEqual({status: 'locked', reason: 'cold-start'});
  });

  it('stays unlocked when app lock is disabled', () => {
    expect(createSessionLockState({enabled: false, backgroundTimeoutMs: 30_000})).toEqual({status: 'unlocked'});
  });

  it('locks after the configured background timeout', () => {
    const backgrounded = recordSessionBackground({status: 'unlocked'}, 1_000);
    expect(resumeSession(backgrounded, enabledPolicy, 31_000)).toEqual({
      status: 'locked',
      reason: 'background-timeout',
    });
  });
  it('returns to unlocked before the timeout and clears background timing', () => {
    const backgrounded = recordSessionBackground({status: 'unlocked'}, 1_000);
    expect(resumeSession(backgrounded, enabledPolicy, 15_000)).toEqual({status: 'unlocked'});
  });

  it('keeps the session locked when unlock is cancelled', () => {
    const locked = markSessionLocked();
    expect(cancelSessionUnlock(locked)).toBe(locked);
  });

  it('only leaves locked state after a caller reports verified authentication', () => {
    expect(completeVerifiedSessionUnlock()).toEqual({status: 'unlocked'});
  });
});
