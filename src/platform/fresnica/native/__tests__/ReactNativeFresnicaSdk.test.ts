import { ReactNativeFresnicaSdk } from '../ReactNativeFresnicaSdk';
import type { NativeFresnicaModule } from '../NativeFresnicaModule';

function createNativeModule(): jest.Mocked<NativeFresnicaModule> {
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
    verifyProtectedSignerPassphrase: jest.fn(),
    hasSignerSystemAuth: jest.fn(),
    removeSignerSystemAuth: jest.fn(),
    removeSystemAuthDomain: jest.fn(),
    signMessageWithSystemAuth: jest.fn(),
    signMessageWithPasscode: jest.fn(),
    signWithSystemAuth: jest.fn(),
    signWithPasscode: jest.fn(),
  };
}

describe('ReactNativeFresnicaSdk', () => {
  it('maps mnemonic protection to the canonical positional bridge call', async () => {
    const native = createNativeModule();
    native.protectMnemonic.mockResolvedValue({
      signerPublicKey: 'GSIGNER',
      envelopeJson: '{"v":1}',
    });
    const sdk = new ReactNativeFresnicaSdk(native);

    await sdk.protectMnemonic({
      mnemonic: 'words',
      mnemonicPassphrase: 'optional passphrase',
      index: 7,
      language: 'english',
      appPassphrase: '123456',
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

  it('maps SEP-53 message signing without normalizing the message', async () => {
    const native = createNativeModule();
    native.signMessageWithSystemAuth.mockResolvedValue('signature-system-auth');
    native.signMessageWithPasscode.mockResolvedValue('signature-passphrase');
    const sdk = new ReactNativeFresnicaSdk(native);
    const message = 'domain.example wants access\nnonce=abc  ';

    await sdk.signMessageWithSystemAuth({
      envelopeJson: '{"v":1}',
      expectedSignerPublicKey: 'GSIGNER',
      message,
      reason: 'Sign dApp challenge',
    });
    await sdk.signMessageWithPassphrase({
      envelopeJson: '{"v":1}',
      appPassphrase: '123456',
      expectedSignerPublicKey: 'GSIGNER',
      message,
    });

    expect(native.signMessageWithSystemAuth).toHaveBeenCalledWith('{"v":1}', 'GSIGNER', message, 'Sign dApp challenge');
    expect(native.signMessageWithPasscode).toHaveBeenCalledWith('{"v":1}', '123456', 'GSIGNER', message);
  });

  it('maps protected-signer passphrase verification without exposing derived material', async () => {
    const native = createNativeModule();
    native.verifyProtectedSignerPassphrase.mockResolvedValue(true);
    const sdk = new ReactNativeFresnicaSdk(native);

    const result = await sdk.verifyProtectedSignerPassphrase({
      envelopeJson: '{"v":1}',
      appPassphrase: 'correct horse battery staple',
      expectedSignerPublicKey: 'GSIGNER',
    });

    expect(result).toBe(true);
    expect(native.verifyProtectedSignerPassphrase).toHaveBeenCalledWith(
      '{"v":1}',
      'correct horse battery staple',
      'GSIGNER',
    );
    expect(native.initializeSystemAuth).not.toHaveBeenCalled();
    expect(native.registerSignerSystemAuth).not.toHaveBeenCalled();
    expect(native.removeSignerSystemAuth).not.toHaveBeenCalled();
    expect(native.removeSystemAuthDomain).not.toHaveBeenCalled();
    expect(native.reveal).not.toHaveBeenCalled();
  });

  it('preserves invalid-passcode from passphrase verification', async () => {
    const native = createNativeModule();
    native.verifyProtectedSignerPassphrase.mockRejectedValue({
      code: 'invalid-passcode',
      message: 'Invalid passcode',
    });
    const sdk = new ReactNativeFresnicaSdk(native);

    await expect(
      sdk.verifyProtectedSignerPassphrase({
        envelopeJson: '{"v":1}',
        appPassphrase: 'wrong passphrase',
        expectedSignerPublicKey: 'GSIGNER',
      }),
    ).rejects.toMatchObject({
      name: 'FresnicaNativeError',
      code: 'invalid-passcode',
    });
  });

  it('keeps system-auth signing separate from passphrase signing', async () => {
    const native = createNativeModule();
    native.signWithSystemAuth.mockResolvedValue('signed-system-auth');
    native.signWithPasscode.mockResolvedValue('signed-passphrase');
    const sdk = new ReactNativeFresnicaSdk(native);

    await sdk.signWithSystemAuth({
      envelopeJson: '{"v":1}',
      expectedSignerPublicKey: 'GSIGNER',
      transactionXdrBase64: 'AAAA',
      networkPassphrase: 'Test SDF Network ; September 2015',
      reason: 'Confirm transaction',
    });

    await sdk.signWithPassphrase({
      envelopeJson: '{"v":1}',
      appPassphrase: '123456',
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

  it('uses reveal only for explicit fresh-passphrase export', async () => {
    const native = createNativeModule();
    native.reveal.mockResolvedValue({ kind: 'secret', secret: 'SSECRET' });
    const sdk = new ReactNativeFresnicaSdk(native);

    const result = await sdk.reveal({
      envelopeJson: '{"v":1}',
      freshAppPassphrase: '654321',
      expectedSignerPublicKey: 'GSIGNER',
    });

    expect(native.reveal).toHaveBeenCalledWith('{"v":1}', '654321', 'GSIGNER');
    expect(result).toEqual({ kind: 'secret', secret: 'SSECRET' });
  });

  it('normalizes native promise rejections before they reach product code', async () => {
    const native = createNativeModule();
    native.signWithSystemAuth.mockRejectedValue({
      code: 'user-cancel',
      message: 'Canceled',
    });
    const sdk = new ReactNativeFresnicaSdk(native);

    await expect(
      sdk.signWithSystemAuth({
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
