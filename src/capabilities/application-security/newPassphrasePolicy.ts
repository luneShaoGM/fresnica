export const NEW_PROTECTION_PASSPHRASE_MIN_UNICODE_SCALARS = 15;

export type NewProtectionPassphraseAssessment = Readonly<{
  unicodeScalarCount: number;
  meetsMinimum: boolean;
}>;

export function assessNewProtectionPassphrase(
  passphrase: string,
): NewProtectionPassphraseAssessment {
  const unicodeScalarCount = Array.from(passphrase).length;
  return {
    unicodeScalarCount,
    meetsMinimum: unicodeScalarCount >= NEW_PROTECTION_PASSPHRASE_MIN_UNICODE_SCALARS,
  };
}

export function assertNewProtectionPassphrase(passphrase: string): void {
  if (!assessNewProtectionPassphrase(passphrase).meetsMinimum) {
    throw new Error('app-passphrase-too-short');
  }
}
