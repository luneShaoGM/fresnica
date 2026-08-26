import { ReactNativeFresnicaCore } from '../ReactNativeFresnicaCore';
import type { NativeFresnicaCoreModule } from '../NativeFresnicaCoreModule';

function createNativeModule(): jest.Mocked<NativeFresnicaCoreModule> {
  return {
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
}

describe('ReactNativeFresnicaCore', () => {
  it('maps mnemonic protection to the canonical positional bridge call', async () => {
    const native = createNativeModule();
    native.protectMnemonic.mockResolvedValue({
      signerPublicKey: 'GSIGNER',
      envelopeJson: '{"v":1}',
    });
    const core = new ReactNativeFresnicaCore(native);

    await core.protectMnemonic({
      mnemonic: 'words',
      mnemonicPassphrase: 'optional passphrase',
      index: 7,
      language: 'english',
      appPasscode: '123456',
      expectedSignerPublicKey: 'GSIGNER',
    });

    expect(native.protectMnemonic).toHaveBeenCalledWith(
      'words',
      'optional passphrase',
      7,
      'english',
      '123456',
      'GSIGNER',
    );
  });

  it('keeps system-auth signing separate from passcode signing', async () => {
    const native = createNativeModule();
    native.signWithSystemAuth.mockResolvedValue('signed-system-auth');
    native.signWithPasscode.mockResolvedValue('signed-passcode');
    const core = new ReactNativeFresnicaCore(native);

    await core.signWithSystemAuth({
      envelopeJson: '{"v":1}',
      expectedSignerPublicKey: 'GSIGNER',
      transactionXdrBase64: 'AAAA',
      networkPassphrase: 'Test SDF Network ; September 2015',
      reason: 'Confirm transaction',
    });

    await core.signWithPasscode({
      envelopeJson: '{"v":1}',
      appPasscode: '123456',
      expectedSignerPublicKey: 'GSIGNER',
      transactionXdrBase64: 'AAAA',
      networkPassphrase: 'Test SDF Network ; September 2015',
    });

    expect(native.signWithSystemAuth).toHaveBeenCalledWith(
      '{"v":1}',
      'GSIGNER',
      'AAAA',
      'Test SDF Network ; September 2015',
      'Confirm transaction',
    );
    expect(native.signWithPasscode).toHaveBeenCalledWith(
      '{"v":1}',
      '123456',
      'GSIGNER',
      'AAAA',
      'Test SDF Network ; September 2015',
    );
  });

  it('uses reveal only for explicit fresh-passcode export', async () => {
    const native = createNativeModule();
    native.reveal.mockResolvedValue({ kind: 'secret', secret: 'SSECRET' });
    const core = new ReactNativeFresnicaCore(native);

    const result = await core.reveal({
      envelopeJson: '{"v":1}',
      freshAppPasscode: '654321',
      expectedSignerPublicKey: 'GSIGNER',
    });

    expect(native.reveal).toHaveBeenCalledWith(
      '{"v":1}',
      '654321',
      'GSIGNER',
    );
    expect(result).toEqual({ kind: 'secret', secret: 'SSECRET' });
  });

  it('normalizes native promise rejections before they reach product code', async () => {
    const native = createNativeModule();
    native.signWithSystemAuth.mockRejectedValue({
      code: 'user-cancel',
      message: 'Canceled',
    });
    const core = new ReactNativeFresnicaCore(native);

    await expect(
      core.signWithSystemAuth({
        envelopeJson: '{"v":1}',
        expectedSignerPublicKey: 'GSIGNER',
        transactionXdrBase64: 'AAAA',
        networkPassphrase: 'Test SDF Network ; September 2015',
        reason: 'Confirm transaction',
      }),
    ).rejects.toMatchObject({
      name: 'FresnicaNativeError',
      code: 'user-cancel',
      message: 'Canceled',
    });
  });
});
