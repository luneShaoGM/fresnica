export type FeatureErrorProjection = Readonly<{
  message: string;
  retryable: boolean;
  cancelled: boolean;
  code?: string;
}>;

export type FeatureErrorProjectionOptions = Readonly<{
  fallbackMessage: string;
  fallbackRetryable?: boolean;
  messages?: Readonly<Record<string, string>>;
  retryableCodes?: readonly string[];
}>;

const BUILTIN_MESSAGES: Readonly<Record<string, string>> = {
  'invalid-passcode': 'The app passphrase is incorrect.',
  'invalid-passphrase': 'The app passphrase is incorrect.',
  'app-passphrase-too-short': 'Use an app passphrase of at least 15 characters.',
  'app-passphrase-confirmation-mismatch': 'The app passphrase confirmation does not match.',
  'invalid-input': 'The provided wallet information is invalid.',
  'user-cancel': 'Authentication was cancelled.',
  'system-auth-unavailable': 'System authentication is unavailable on this device.',
  'system-auth-not-enrolled': 'System authentication is not set up for this signer.',
  'system-auth-invalidated': 'System authentication must be set up again.',
  'system-auth-failed': 'System authentication failed. Try again.',
  'auth-in-progress': 'Another authentication request is already in progress.',
  timeout: 'The network request timed out. Try again.',
  'review-expired': 'This transaction review expired. Rebuild it before signing.',
  'invalid-trustline-limit': 'Enter a positive trustline limit with up to 7 decimal places.',
  'trustline-limit-below-commitment':
    'The new trustline limit cannot be lower than the current balance plus buying liabilities.',
  'trustline-not-found': 'This trustline no longer exists. Refresh the asset list and try again.',
  'trustline-already-exists': 'This trustline already exists. Refresh the asset list before changing it.',
  'trustline-issuer-account-inactive':
    'The asset issuer must exist on the current network to keep a non-zero trustline.',
  'trustline-review-operation-state-changed':
    'The trustline state changed after review. Go back and build a new review before signing.',
  'trustline-review-limit-state-changed':
    'The trustline limit state changed after review. Go back and build a new review before signing.',
  'trustline-review-authorization-state-changed':
    'Trustline authorization changed after review. Go back and build a new review before signing.',
  'trustline-review-clawback-state-changed':
    'Trustline clawback state changed after review. Go back and build a new review before signing.',
};

const BUILTIN_RETRYABLE = new Set([
  'invalid-passcode',
  'invalid-passphrase',
  'user-cancel',
  'system-auth-failed',
  'auth-in-progress',
  'timeout',
  'review-expired',
  'invalid-trustline-limit',
  'trustline-limit-below-commitment',
  'trustline-not-found',
  'trustline-review-operation-state-changed',
  'trustline-review-limit-state-changed',
  'trustline-review-authorization-state-changed',
  'trustline-review-clawback-state-changed',
]);

export function projectFeatureError(
  error: unknown,
  options: FeatureErrorProjectionOptions,
): FeatureErrorProjection {
  const code = extractErrorCode(error);
  const messages = options.messages ?? {};
  const message = code ? messages[code] ?? BUILTIN_MESSAGES[code] : undefined;
  const retryableCodes = new Set(options.retryableCodes ?? []);
  const retryable = code
    ? retryableCodes.has(code) || BUILTIN_RETRYABLE.has(code)
    : Boolean(options.fallbackRetryable);

  return {
    message: message ?? options.fallbackMessage,
    retryable,
    cancelled: code === 'user-cancel',
    ...(code === undefined ? {} : {code}),
  };
}

function extractErrorCode(error: unknown): string | undefined {
  if (error !== null && typeof error === 'object') {
    const code = (error as {code?: unknown}).code;
    if (typeof code === 'string' && code.trim().length > 0) {
      return normalizeCode(code);
    }
  }

  if (!(error instanceof Error)) {
    return undefined;
  }

  if (error.message === 'Reviewed transaction is expired') {
    return 'review-expired';
  }

  const message = error.message.trim();
  if (/^[a-z0-9]+(?:[-_:][a-z0-9]+)*$/i.test(message)) {
    return normalizeCode(message);
  }

  return undefined;
}

function normalizeCode(value: string): string {
  return value.trim().toLowerCase();
}
