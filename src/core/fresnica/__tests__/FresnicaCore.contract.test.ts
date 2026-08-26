import type { FresnicaCore } from '../FresnicaCore';

describe('FresnicaCore contract', () => {
  it('mirrors the canonical native adapter surface without exposing unlock keys', () => {
    const allowed: Array<keyof FresnicaCore> = [
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

    expect(allowed).not.toContain('deriveUnlockKey' as keyof FresnicaCore);
    expect(allowed).not.toContain('validateUnlockKey' as keyof FresnicaCore);
    expect(allowed).not.toContain('signTransactionXdr' as keyof FresnicaCore);
    expect(allowed).not.toContain('getWalletUnlockKey' as keyof FresnicaCore);
    expect(allowed).not.toContain('decryptSecret' as keyof FresnicaCore);
  });
});
