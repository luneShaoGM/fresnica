import {
  SYSTEM_AUTH_DISABLE_IDLE,
  beginSystemAuthDisable,
  cancelSystemAuthDisable,
  completeSystemAuthDisable,
  failSystemAuthDisable,
  requestSystemAuthDisable,
} from '../systemAuthDisableFlow';

describe('systemAuthDisableFlow', () => {
  it('requires an explicit confirmation before entering the disabling state', () => {
    expect(() => beginSystemAuthDisable(SYSTEM_AUTH_DISABLE_IDLE)).toThrow(
      'system-auth-disable-confirmation-required',
    );

    const confirming = requestSystemAuthDisable(SYSTEM_AUTH_DISABLE_IDLE);
    expect(confirming).toEqual({kind: 'confirming'});
    expect(beginSystemAuthDisable(confirming)).toEqual({kind: 'disabling'});
  });

  it('cancels confirmation without progressing the destructive action', () => {
    const confirming = requestSystemAuthDisable(SYSTEM_AUTH_DISABLE_IDLE);
    expect(cancelSystemAuthDisable(confirming)).toBe(SYSTEM_AUTH_DISABLE_IDLE);
  });

  it('does not let backdrop or system-back cancellation interrupt an in-flight disable', () => {
    const disabling = beginSystemAuthDisable(requestSystemAuthDisable(SYSTEM_AUTH_DISABLE_IDLE));
    expect(cancelSystemAuthDisable(disabling)).toBe(disabling);
  });

  it('returns to confirmation after failure and closes only after success', () => {
    expect(failSystemAuthDisable('native failure')).toEqual({
      kind: 'confirming',
      error: 'native failure',
    });
    expect(completeSystemAuthDisable()).toBe(SYSTEM_AUTH_DISABLE_IDLE);
  });
});
