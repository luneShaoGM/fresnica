import type { FresnicaCore } from '../FresnicaCore';

describe('FresnicaCore contract', () => {
  it('exposes only product-safe operations to TypeScript', () => {
    const allowed: Array<keyof FresnicaCore> = [
      'getCompatibility',
      'parseAccount',
      'generateMnemonic',
      'protectMnemonic',
      'protectSecret',
      'signProtectedTransaction',
      'reprotect',
      'exportSigningMaterial',
    ];

    expect(allowed).not.toContain('decryptSecret' as keyof FresnicaCore);
    expect(allowed).not.toContain('getPrivateKey' as keyof FresnicaCore);
    expect(allowed).not.toContain('getWalletUnlockKey' as keyof FresnicaCore);
  });
});
