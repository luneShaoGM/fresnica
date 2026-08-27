export type FresnicaNativeErrorCode =
  | 'invalid-input'
  | 'invalid-passcode'
  | 'invalid-unlock-key'
  | 'invalid-protected-data'
  | 'identity-mismatch'
  | 'invalid-transaction'
  | 'core-error'
  | 'auth-in-progress'
  | 'user-cancel'
  | 'system-auth-unavailable'
  | 'system-auth-not-enrolled'
  | 'system-auth-invalidated'
  | 'system-auth-failed'
  | 'native-error';

const KNOWN_CODES = new Set<FresnicaNativeErrorCode>([
  'invalid-input',
  'invalid-passcode',
  'invalid-unlock-key',
  'invalid-protected-data',
  'identity-mismatch',
  'invalid-transaction',
  'core-error',
  'auth-in-progress',
  'user-cancel',
  'system-auth-unavailable',
  'system-auth-not-enrolled',
  'system-auth-invalidated',
  'system-auth-failed',
  'native-error',
]);

export class FresnicaNativeError extends Error {
  readonly code: FresnicaNativeErrorCode;
  readonly cause: unknown;

  constructor(
    code: FresnicaNativeErrorCode,
    message: string,
    cause: unknown,
  ) {
    super(message);
    this.name = 'FresnicaNativeError';
    this.code = code;
    this.cause = cause;
  }
}

export function normalizeFresnicaNativeError(error: unknown): FresnicaNativeError {
  if (error instanceof FresnicaNativeError) {
    return error;
  }

  if (error !== null && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    const code = record.code;
    const message = record.message;

    if (typeof code === 'string' && KNOWN_CODES.has(code as FresnicaNativeErrorCode)) {
      return new FresnicaNativeError(
        code as FresnicaNativeErrorCode,
        typeof message === 'string' && message.length > 0
          ? message
          : 'Fresnica native operation failed',
        error,
      );
    }
  }

  const message = error instanceof Error && error.message.length > 0
    ? error.message
    : 'Fresnica native operation failed';

  return new FresnicaNativeError('native-error', message, error);
}
