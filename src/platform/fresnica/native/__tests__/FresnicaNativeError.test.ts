import {
  FresnicaNativeError,
  normalizeFresnicaNativeError,
} from '../FresnicaNativeError';

describe('normalizeFresnicaNativeError', () => {
  it('preserves a canonical Fresnica bridge error code', () => {
    const source = {
      code: 'system-auth-invalidated',
      message: 'Biometric enrollment changed',
    };

    const error = normalizeFresnicaNativeError(source);

    expect(error).toBeInstanceOf(FresnicaNativeError);
    expect(error.code).toBe('system-auth-invalidated');
    expect(error.message).toBe('Biometric enrollment changed');
    expect(error.cause).toBe(source);
  });

  it('normalizes user cancellation without losing the cancellation category', () => {
    const error = normalizeFresnicaNativeError({
      code: 'user-cancel',
      message: 'Canceled',
    });

    expect(error.code).toBe('user-cancel');
  });

  it('falls back to native-error for unknown bridge failures', () => {
    const source = new Error('Unexpected failure');

    const error = normalizeFresnicaNativeError(source);

    expect(error.code).toBe('native-error');
    expect(error.message).toBe('Unexpected failure');
    expect(error.cause).toBe(source);
  });
});
