import type { FresnicaSdkPort } from '../../../capabilities/ports/FresnicaSdkPort';
import type {
  ApplyEd25519SignatureInput,
  DeriveMnemonicSignerInput,
  GenerateMnemonicInput,
  PrepareEd25519SigningInput,
  ProtectMnemonicInput,
  ProtectSecretInput,
  RegisterSignerSystemAuthInput,
  ReprotectInput,
  RevealedSigningMaterial,
  RevealInput,
  SignMessageWithPassphraseInput,
  SignMessageWithSystemAuthInput,
  SignWithPassphraseInput,
  SignWithSystemAuthInput,
} from '../../../capabilities/ports/fresnicaTypes';
import { normalizeFresnicaNativeError } from './FresnicaNativeError';
import type { NativeFresnicaModule } from './NativeFresnicaModule';

type LegacyAppPasscodeInput<T extends { appPassphrase: string }> = Omit<T, 'appPassphrase'> & {
  appPasscode: string;
};

type LegacyReprotectInput = Omit<ReprotectInput, 'currentPassphrase' | 'newPassphrase'> & {
  currentPasscode: string;
  newPasscode: string;
};

type LegacyRevealInput = Omit<RevealInput, 'freshAppPassphrase'> & {
  freshAppPasscode: string;
};

export class ReactNativeFresnicaSdk implements FresnicaSdkPort {
  constructor(private readonly native: NativeFresnicaModule) {}

  parseAccount(address: string) {
    return this.invoke(() => this.native.parseAccount(address));
  }

  protectSecret(input: ProtectSecretInput | LegacyAppPasscodeInput<ProtectSecretInput>) {
    return this.invoke(() =>
      this.native.protectSecret(input.secret, this.readAppPassphrase(input), input.expectedSignerPublicKey),
    );
  }

  protectMnemonic(input: ProtectMnemonicInput | LegacyAppPasscodeInput<ProtectMnemonicInput>) {
    return this.invoke(() =>
      this.native.protectMnemonic(
        input.mnemonic,
        input.mnemonicPassphrase,
        input.index,
        input.language,
        this.readAppPassphrase(input),
        input.expectedSignerPublicKey,
      ),
    );
  }

  generateMnemonic(input: GenerateMnemonicInput | LegacyAppPasscodeInput<GenerateMnemonicInput>) {
    return this.invoke(() =>
      this.native.generateMnemonic(
        input.language,
        input.strength,
        input.mnemonicPassphrase,
        input.index,
        this.readAppPassphrase(input),
      ),
    );
  }

  deriveMnemonicSigner(input: DeriveMnemonicSignerInput | LegacyAppPasscodeInput<DeriveMnemonicSignerInput>) {
    return this.invoke(() =>
      this.native.deriveMnemonicSigner(
        input.sourceEnvelopeJson,
        this.readAppPassphrase(input),
        input.expectedSourceSignerPublicKey,
        input.index,
      ),
    );
  }

  reprotect(input: ReprotectInput | LegacyReprotectInput) {
    return this.invoke(() =>
      this.native.reprotect(
        input.envelopeJson,
        'currentPassphrase' in input ? input.currentPassphrase : input.currentPasscode,
        'newPassphrase' in input ? input.newPassphrase : input.newPasscode,
        input.expectedSignerPublicKey,
      ),
    );
  }

  reveal(input: RevealInput | LegacyRevealInput): Promise<RevealedSigningMaterial> {
    return this.invoke(() =>
      this.native.reveal(
        input.envelopeJson,
        'freshAppPassphrase' in input ? input.freshAppPassphrase : input.freshAppPasscode,
        input.expectedSignerPublicKey,
      ),
    );
  }

  prepareEd25519Signing(input: PrepareEd25519SigningInput) {
    return this.invoke(() => this.native.prepareEd25519Signing(input.transactionXdrBase64, input.networkPassphrase));
  }

  applyEd25519Signature(input: ApplyEd25519SignatureInput) {
    return this.invoke(() =>
      this.native.applyEd25519Signature(
        input.transactionXdrBase64,
        input.networkPassphrase,
        input.signerPublicKey,
        input.signatureBase64,
      ),
    );
  }

  canUseSystemAuth() {
    return this.invoke(() => this.native.canUseSystemAuth());
  }

  hasSystemAuthDomain() {
    return this.invoke(() => this.native.hasSystemAuthDomain());
  }

  initializeSystemAuth(reason: string) {
    return this.invoke(() => this.native.initializeSystemAuth(reason));
  }

  registerSignerSystemAuth(
    input: RegisterSignerSystemAuthInput | LegacyAppPasscodeInput<RegisterSignerSystemAuthInput>,
  ) {
    return this.invoke(() =>
      this.native.registerSignerSystemAuth(
        input.envelopeJson,
        this.readAppPassphrase(input),
        input.expectedSignerPublicKey,
      ),
    );
  }

  hasSignerSystemAuth(expectedSignerPublicKey: string) {
    return this.invoke(() => this.native.hasSignerSystemAuth(expectedSignerPublicKey));
  }

  removeSignerSystemAuth(expectedSignerPublicKey: string) {
    return this.invoke(() => this.native.removeSignerSystemAuth(expectedSignerPublicKey));
  }

  removeSystemAuthDomain() {
    return this.invoke(() => this.native.removeSystemAuthDomain());
  }

  signMessageWithSystemAuth(input: SignMessageWithSystemAuthInput) {
    return this.invoke(() =>
      this.native.signMessageWithSystemAuth(
        input.envelopeJson,
        input.expectedSignerPublicKey,
        input.message,
        input.reason,
      ),
    );
  }

  signMessageWithPassphrase(input: SignMessageWithPassphraseInput) {
    return this.invoke(() =>
      this.native.signMessageWithPasscode(
        input.envelopeJson,
        input.appPassphrase,
        input.expectedSignerPublicKey,
        input.message,
      ),
    );
  }

  signWithSystemAuth(input: SignWithSystemAuthInput) {
    return this.invoke(() =>
      this.native.signWithSystemAuth(
        input.envelopeJson,
        input.expectedSignerPublicKey,
        input.transactionXdrBase64,
        input.networkPassphrase,
        input.reason,
      ),
    );
  }

  /**
   * Temporary concrete-adapter compatibility for callers that still use the
   * pre-capability-port name. FresnicaSdkPort does not expose this method.
   */
  signWithPasscode(input: {
    envelopeJson: string;
    appPasscode: string;
    expectedSignerPublicKey: string;
    transactionXdrBase64: string;
    networkPassphrase: string;
  }) {
    return this.signWithPassphrase({
      envelopeJson: input.envelopeJson,
      appPassphrase: input.appPasscode,
      expectedSignerPublicKey: input.expectedSignerPublicKey,
      transactionXdrBase64: input.transactionXdrBase64,
      networkPassphrase: input.networkPassphrase,
    });
  }

  signWithPassphrase(input: SignWithPassphraseInput) {
    return this.invoke(() =>
      this.native.signWithPasscode(
        input.envelopeJson,
        input.appPassphrase,
        input.expectedSignerPublicKey,
        input.transactionXdrBase64,
        input.networkPassphrase,
      ),
    );
  }

  private readAppPassphrase(input: { appPassphrase: string } | { appPasscode: string }): string {
    return 'appPassphrase' in input ? input.appPassphrase : input.appPasscode;
  }

  private invoke<T>(operation: () => Promise<T>): Promise<T> {
    return operation().catch(error => {
      throw normalizeFresnicaNativeError(error);
    });
  }
}
