import vectors from './new-passphrase-vectors.json';
import {
  NEW_PROTECTION_PASSPHRASE_MIN_UNICODE_SCALARS,
  assessNewProtectionPassphrase,
  assertNewProtectionPassphrase,
} from '../newPassphrasePolicy';

describe('new protection passphrase policy', () => {
  it('recommends at least 15 Unicode scalar values', () => {
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
      rejection: 'predictable',
    });
  });

  it('fails closed without normalizing a short credential', () => {
    expect(() => assertNewProtectionPassphrase('123456')).toThrow('app-passphrase-numeric-only');
  });
});

it('requires explicit short-risk acceptance only after weak-password screening', () => {
  expect(() => assertNewProtectionPassphrase('river sky')).toThrow('app-passphrase-short-risk-required');
  expect(() => assertNewProtectionPassphrase('river sky', true)).not.toThrow();
  for (const value of [
    '',
    '   ',
    '１２３４５６',
    '١٢٣٤٥٦',
    '111111111111111',
    'abcabcabcabcabc',
    'Password123!',
    'abcdefghijklmnop',
    'correct horse battery staple',
  ]) {
    expect(() => assertNewProtectionPassphrase(value, true)).toThrow();
  }
  for (const value of ['amber river under quiet moon', '萤火照亮自己的路前行吧钱包安全', 'rain 7 lanterns!']) {
    expect(() => assertNewProtectionPassphrase(value, true)).not.toThrow();
  }
});

it.each(vectors)('applies Mobile screening for a fixture (allowed=$allowed)', ({ value, allowed }) => {
  expect(!assessNewProtectionPassphrase(value).rejection).toBe(allowed);
});
