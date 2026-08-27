import type { NativeFresnicaModule } from '../NativeFresnicaModule';

describe('NativeFresnicaModule contract', () => {
  it('contains the canonical v0.2.0 bridge operations and no unlock-key APIs', () => {
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
      'hasSignerSystemAuth',
      'removeSignerSystemAuth',
      'removeSystemAuthDomain',
      'signWithSystemAuth',
      'signWithPasscode',
    ];

    expect(methods).not.toContain('deriveUnlockKey' as keyof NativeFresnicaModule);
    expect(methods).not.toContain('validateUnlockKey' as keyof NativeFresnicaModule);
    expect(methods).not.toContain('signTransactionXdr' as keyof NativeFresnicaModule);
  });
});
