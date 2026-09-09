import {
  NEW_PROTECTION_PASSPHRASE_MIN_UNICODE_SCALARS,
  assessNewProtectionPassphrase,
  assertNewProtectionPassphrase,
} from '../newPassphrasePolicy';

describe('new protection passphrase policy', () => {
  it('requires at least 15 Unicode scalar values', () => {
    expect(NEW_PROTECTION_PASSPHRASE_MIN_UNICODE_SCALARS).toBe(15);
    expect(assessNewProtectionPassphrase('a'.repeat(14)).meetsMinimum).toBe(false);
    expect(assessNewProtectionPassphrase('a'.repeat(15)).meetsMinimum).toBe(true);
  });

  it('counts Unicode code points rather than UTF-16 code units', () => {
    const passphrase = '🔐'.repeat(15);
    expect(passphrase.length).toBe(30);
    expect(assessNewProtectionPassphrase(passphrase)).toEqual({
      unicodeScalarCount: 15,
      meetsMinimum: true,
    });
  });

  it('fails closed without normalizing a short credential', () => {
    expect(() => assertNewProtectionPassphrase('123456')).toThrow('app-passphrase-too-short');
  });
});
