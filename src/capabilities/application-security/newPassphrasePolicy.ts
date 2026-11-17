// Compatibility name: this length is recommended; shorter phrases require risk acceptance.
export const NEW_PROTECTION_PASSPHRASE_MIN_UNICODE_SCALARS = 15;

export type NewProtectionPassphraseAssessment = Readonly<{
  unicodeScalarCount: number;
  meetsMinimum: boolean;
  rejection?: 'empty' | 'numeric-only' | 'predictable';
}>;

// Mobile product restrictions supplement upstream length guidance; never change Core credential bytes.
export function assessNewProtectionPassphrase(passphrase: string): NewProtectionPassphraseAssessment {
  const characters = Array.from(passphrase);
  const screened = Array.from(
    passphrase.replace(/[A-Z]/g, c => c.toLowerCase()).replace(/[\p{White_Space}\uFEFF]/gu, ''),
  );
  const text = screened.join('');
  const withoutSimpleAffixes = text.replace(/^[\p{N}\p{P}\p{S}]+|[\p{N}\p{P}\p{S}]+$/gu, '');
  const common = [
    'password',
    'password123',
    'password123!',
    'letmein',
    'qwerty',
    'qwerty123',
    'changeme',
    'iloveyou',
    'admin',
    'welcome',
    'correcthorsebatterystaple',
  ];
  const sequences = [
    'abcdefghijklmnopqrstuvwxyz',
    'zyxwvutsrqponmlkjihgfedcba',
    'qwertyuiopasdfghjklzxcvbnm',
    'mnbvcxzlkjhgfdsapoiuytrewq',
  ];
  let repeated = false;
  for (let width = 1; width <= screened.length / 2; width += 1) {
    if (screened.length % width === 0 && screened.every((c, i) => c === screened[i % width])) {
      repeated = true;
      break;
    }
  }
  const rejection = !passphrase
    ? 'empty'
    : screened.length < 2
      ? 'predictable'
      : /^\p{N}+$/u.test(text)
        ? 'numeric-only'
        : common.includes(text) ||
            common.includes(withoutSimpleAffixes) ||
            repeated ||
            (text.length >= 4 && sequences.some(s => s.includes(text)))
          ? 'predictable'
          : undefined;
  return {
    unicodeScalarCount: characters.length,
    meetsMinimum: characters.length >= NEW_PROTECTION_PASSPHRASE_MIN_UNICODE_SCALARS,
    ...(rejection ? { rejection } : {}),
  };
}

export function assertNewProtectionPassphrase(passphrase: string, shortRiskAccepted = false): void {
  const assessment = assessNewProtectionPassphrase(passphrase);
  if (assessment.rejection) throw new Error(`app-passphrase-${assessment.rejection}`);
  if (!assessment.meetsMinimum && shortRiskAccepted !== true) throw new Error('app-passphrase-short-risk-required');
}
