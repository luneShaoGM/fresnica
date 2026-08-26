import { loadNativeFresnicaCoreModule } from '../loadNativeFresnicaCoreModule';

const validModule = {
  parseAccount: jest.fn(),
  protectSecret: jest.fn(),
  protectMnemonic: jest.fn(),
  generateMnemonic: jest.fn(),
  deriveMnemonicSigner: jest.fn(),
  reprotect: jest.fn(),
  reveal: jest.fn(),
  prepareEd25519Signing: jest.fn(),
  applyEd25519Signature: jest.fn(),
  canUseSystemAuth: jest.fn(),
  hasSystemAuthDomain: jest.fn(),
  initializeSystemAuth: jest.fn(),
  registerSignerSystemAuth: jest.fn(),
  hasSignerSystemAuth: jest.fn(),
  removeSignerSystemAuth: jest.fn(),
  removeSystemAuthDomain: jest.fn(),
  signWithSystemAuth: jest.fn(),
  signWithPasscode: jest.fn(),
};

describe('loadNativeFresnicaCoreModule', () => {
  it('returns the FresnicaCore native module when the canonical bridge is available', () => {
    expect(loadNativeFresnicaCoreModule({ FresnicaCore: validModule })).toBe(validModule);
  });

  it('fails explicitly when the FresnicaCore module is not linked', () => {
    expect(() => loadNativeFresnicaCoreModule({})).toThrow(
      'FresnicaCore native module is not linked',
    );
  });

  it('fails explicitly when the linked module is missing a required bridge method', () => {
    const { signWithSystemAuth: _missing, ...incompleteModule } = validModule;

    expect(() => loadNativeFresnicaCoreModule({ FresnicaCore: incompleteModule })).toThrow(
      'FresnicaCore native module is incompatible: missing signWithSystemAuth',
    );
  });
});
