export type SessionLockReason = 'cold-start' | 'background-timeout' | 'manual';

export type SessionLockState =
  | Readonly<{
      status: 'unlocked';
      backgroundedAt?: number;
    }>
  | Readonly<{
      status: 'locked';
      reason: SessionLockReason;
    }>;

export type SessionLockPolicy = Readonly<{
  enabled: boolean;
  backgroundTimeoutMs: number;
}>;

export function createSessionLockState(policy: SessionLockPolicy): SessionLockState {
  return policy.enabled ? {status: 'locked', reason: 'cold-start'} : {status: 'unlocked'};
}

export function recordSessionBackground(
  state: SessionLockState,
  backgroundedAt: number,
): SessionLockState {
  return state.status === 'locked' ? state : {status: 'unlocked', backgroundedAt};
}
export function resumeSession(
  state: SessionLockState,
  policy: SessionLockPolicy,
  resumedAt: number,
): SessionLockState {
  if (!policy.enabled) {
    return {status: 'unlocked'};
  }
  if (state.status === 'locked') {
    return state;
  }
  if (state.backgroundedAt === undefined) {
    return state;
  }
  if (resumedAt - state.backgroundedAt >= policy.backgroundTimeoutMs) {
    return {status: 'locked', reason: 'background-timeout'};
  }
  return {status: 'unlocked'};
}

export function markSessionLocked(reason: SessionLockReason = 'manual'): SessionLockState {
  return {status: 'locked', reason};
}

export function completeVerifiedSessionUnlock(): SessionLockState {
  return {status: 'unlocked'};
}

export function cancelSessionUnlock(state: SessionLockState): SessionLockState {
  return state;
}
