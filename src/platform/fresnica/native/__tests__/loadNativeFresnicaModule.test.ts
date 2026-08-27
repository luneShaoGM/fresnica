import { loadNativeFresnicaModule } from '../loadNativeFresnicaModule';

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

describe('loadNativeFresnicaModule', () => {
  it('loads only the upstream FresnicaCore NativeModules key', () => {
    expect(loadNativeFresnicaModule({ FresnicaCore: validModule })).toBe(validModule);
    expect(() => loadNativeFresnicaModule({ FresnicaSdk: validModule })).toThrow(
      'FresnicaCore native module is not linked',
    );
  });

  it('fails explicitly when a required bridge method is missing', () => {
    const { signWithSystemAuth: _missing, ...incompleteModule } = validModule;

    expect(() => loadNativeFresnicaModule({ FresnicaCore: incompleteModule })).toThrow(
      'FresnicaCore native module is incompatible: missing signWithSystemAuth',
    );
  });
});
