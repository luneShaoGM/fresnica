import {projectFeatureError} from '../featureError';

describe('projectFeatureError', () => {
  it('maps native compatibility passcode errors to passphrase product copy', () => {
    expect(
      projectFeatureError(
        {code: 'invalid-passcode', message: 'native detail'},
        {fallbackMessage: 'Unable to authenticate.'},
      ),
    ).toEqual({
      message: 'The app passphrase is incorrect.',
      retryable: true,
      cancelled: false,
      code: 'invalid-passcode',
    });
  });

  it('marks network timeout as retryable', () => {
    expect(projectFeatureError(new Error('timeout'), {fallbackMessage: 'Unable to load.'})).toMatchObject({
      message: 'The network request timed out. Try again.',
      retryable: true,
      cancelled: false,
      code: 'timeout',
    });
  });
  it('maps the reviewed-transaction expiry sentinel without exposing internals', () => {
    expect(
      projectFeatureError(new Error('Reviewed transaction is expired'), {
        fallbackMessage: 'Unable to continue.',
      }),
    ).toMatchObject({
      message: 'This transaction review expired. Rebuild it before signing.',
      retryable: true,
      code: 'review-expired',
    });
  });

  it('uses the safe fallback for unknown internal error messages', () => {
    const projection = projectFeatureError(new Error('secret internal detail'), {
      fallbackMessage: 'Unable to continue.',
    });
    expect(projection).toEqual({
      message: 'Unable to continue.',
      retryable: false,
      cancelled: false,
    });
    expect(projection.message).not.toContain('secret internal detail');
  });
  it('supports feature-owned copy and retry classification without changing the shared helper', () => {
    expect(
      projectFeatureError(new Error('payment-source-account-inactive'), {
        fallbackMessage: 'Unable to send.',
        messages: {'payment-source-account-inactive': 'Activate this account before sending.'},
        retryableCodes: ['payment-source-account-inactive'],
      }),
    ).toEqual({
      message: 'Activate this account before sending.',
      retryable: true,
      cancelled: false,
      code: 'payment-source-account-inactive',
    });
  });

  it('projects trustline limit validation without exposing internal codes as product copy', () => {
    expect(
      projectFeatureError(new Error('trustline-limit-below-commitment'), {
        fallbackMessage: 'Unable to manage this asset.',
      }),
    ).toMatchObject({
      message: 'The new trustline limit cannot be lower than the current balance plus buying liabilities.',
      retryable: true,
      code: 'trustline-limit-below-commitment',
    });
  });

  it('marks explicit authentication cancellation separately from failure', () => {
    expect(
      projectFeatureError({code: 'user-cancel'}, {fallbackMessage: 'Unable to authenticate.'}),
    ).toMatchObject({
      message: 'Authentication was cancelled.',
      retryable: true,
      cancelled: true,
    });
  });
});
