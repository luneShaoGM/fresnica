import type { NativeFresnicaCoreModule } from '../NativeFresnicaCoreModule';

describe('NativeFresnicaCoreModule contract', () => {
  it('contains the canonical v0.2.0 bridge operations and no unlock-key APIs', () => {
    const methods: Array<keyof NativeFresnicaCoreModule> = [
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

    expect(methods).not.toContain('deriveUnlockKey' as keyof NativeFresnicaCoreModule);
    expect(methods).not.toContain('validateUnlockKey' as keyof NativeFresnicaCoreModule);
    expect(methods).not.toContain('signTransactionXdr' as keyof NativeFresnicaCoreModule);
  });
});
