import type { NativeFresnicaModule } from '../NativeFresnicaModule';

describe('NativeFresnicaModule contract', () => {
  it('contains the canonical adapter bridge operations and no unexposed native-only APIs', () => {
    const methods: Array<keyof NativeFresnicaModule> = [
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
      'verifyProtectedSignerPassphrase',
      'hasSignerSystemAuth',
      'removeSignerSystemAuth',
      'removeSystemAuthDomain',
      'signMessageWithSystemAuth',
      'signMessageWithPasscode',
      'signWithSystemAuth',
      'signWithPasscode',
    ];

    expect(methods).not.toContain('deriveUnlockKey' as keyof NativeFresnicaModule);
    expect(methods).not.toContain('validateUnlockKey' as keyof NativeFresnicaModule);
    expect(methods).not.toContain('signTransactionXdr' as keyof NativeFresnicaModule);
  });
});
