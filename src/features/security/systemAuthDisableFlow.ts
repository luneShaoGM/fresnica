export type SystemAuthDisableFlowState =
  | Readonly<{kind: 'idle'}>
  | Readonly<{kind: 'confirming'; error?: string}>
  | Readonly<{kind: 'disabling'}>;

export const SYSTEM_AUTH_DISABLE_IDLE: SystemAuthDisableFlowState = Object.freeze({kind: 'idle'});

export function requestSystemAuthDisable(
  state: SystemAuthDisableFlowState,
): SystemAuthDisableFlowState {
  if (state.kind === 'disabling') {
    return state;
  }
  return {kind: 'confirming'};
}

export function cancelSystemAuthDisable(
  state: SystemAuthDisableFlowState,
): SystemAuthDisableFlowState {
  return state.kind === 'disabling' ? state : SYSTEM_AUTH_DISABLE_IDLE;
}
export function beginSystemAuthDisable(
  state: SystemAuthDisableFlowState,
): SystemAuthDisableFlowState {
  if (state.kind !== 'confirming') {
    throw new Error('system-auth-disable-confirmation-required');
  }
  return {kind: 'disabling'};
}

export function failSystemAuthDisable(message: string): SystemAuthDisableFlowState {
  return {kind: 'confirming', error: message};
}

export function completeSystemAuthDisable(): SystemAuthDisableFlowState {
  return SYSTEM_AUTH_DISABLE_IDLE;
}
