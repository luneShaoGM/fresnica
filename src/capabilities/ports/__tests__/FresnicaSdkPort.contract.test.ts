import type { FresnicaSdkPort } from '../FresnicaSdkPort';

describe('FresnicaSdkPort contract', () => {
  it('mirrors the canonical native adapter surface without exposing unlock keys', () => {
    const allowed: Array<keyof FresnicaSdkPort> = [
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
      'signMessageWithSystemAuth',
      'signMessageWithPassphrase',
      'signWithSystemAuth',
      'signWithPassphrase',
    ];

    expect(allowed).not.toContain('deriveUnlockKey' as keyof FresnicaSdkPort);
    expect(allowed).not.toContain('validateUnlockKey' as keyof FresnicaSdkPort);
    expect(allowed).not.toContain('signTransactionXdr' as keyof FresnicaSdkPort);
    expect(allowed).not.toContain('getWalletUnlockKey' as keyof FresnicaSdkPort);
    expect(allowed).not.toContain('decryptSecret' as keyof FresnicaSdkPort);
  });
});
