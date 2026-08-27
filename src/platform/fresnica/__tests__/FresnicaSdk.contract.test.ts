import type { FresnicaSdk } from '../FresnicaSdk';

describe('FresnicaSdk contract', () => {
  it('mirrors the canonical native adapter surface without exposing unlock keys', () => {
    const allowed: Array<keyof FresnicaSdk> = [
      'parseAccount',
      'protectSecret',
      'protectMnemonic',
      'generateMnemonic',
      'deriveMnemonicSigner',
      'reprotect',
      'reveal',
      'prepareEd25519Signing',
      'applyEd25519Signature',
      'canUseSystemAuth',
      'hasSystemAuthDomain',
      'initializeSystemAuth',
      'registerSignerSystemAuth',
      'hasSignerSystemAuth',
      'removeSignerSystemAuth',
      'removeSystemAuthDomain',
      'signWithSystemAuth',
      'signWithPasscode',
    ];

    expect(allowed).not.toContain('deriveUnlockKey' as keyof FresnicaSdk);
    expect(allowed).not.toContain('validateUnlockKey' as keyof FresnicaSdk);
    expect(allowed).not.toContain('signTransactionXdr' as keyof FresnicaSdk);
    expect(allowed).not.toContain('getWalletUnlockKey' as keyof FresnicaSdk);
    expect(allowed).not.toContain('decryptSecret' as keyof FresnicaSdk);
  });
});
