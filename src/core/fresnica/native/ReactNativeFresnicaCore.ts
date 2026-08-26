import type { FresnicaCore } from '../FresnicaCore';
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
  SignWithPasscodeInput,
  SignWithSystemAuthInput,
} from '../types';
import { normalizeFresnicaNativeError } from './FresnicaNativeError';
import type { NativeFresnicaCoreModule } from './NativeFresnicaCoreModule';

export class ReactNativeFresnicaCore implements FresnicaCore {
  constructor(private readonly native: NativeFresnicaCoreModule) {}

  parseAccount(address: string) {
    return this.invoke(() => this.native.parseAccount(address));
  }

  protectSecret(input: ProtectSecretInput) {
    return this.invoke(() =>
      this.native.protectSecret(
        input.secret,
        input.appPasscode,
        input.expectedSignerPublicKey,
      ),
    );
  }

  protectMnemonic(input: ProtectMnemonicInput) {
    return this.invoke(() =>
      this.native.protectMnemonic(
        input.mnemonic,
        input.mnemonicPassphrase,
        input.index,
        input.language,
        input.appPasscode,
        input.expectedSignerPublicKey,
      ),
    );
  }

  generateMnemonic(input: GenerateMnemonicInput) {
    return this.invoke(() =>
      this.native.generateMnemonic(
        input.language,
        input.strength,
        input.mnemonicPassphrase,
        input.index,
        input.appPasscode,
      ),
    );
  }

  deriveMnemonicSigner(input: DeriveMnemonicSignerInput) {
    return this.invoke(() =>
      this.native.deriveMnemonicSigner(
        input.sourceEnvelopeJson,
        input.appPasscode,
        input.expectedSourceSignerPublicKey,
        input.index,
      ),
    );
  }

  reprotect(input: ReprotectInput) {
    return this.invoke(() =>
      this.native.reprotect(
        input.envelopeJson,
        input.currentPasscode,
        input.newPasscode,
        input.expectedSignerPublicKey,
      ),
    );
  }

  reveal(input: RevealInput): Promise<RevealedSigningMaterial> {
    return this.invoke(() =>
      this.native.reveal(
        input.envelopeJson,
        input.freshAppPasscode,
        input.expectedSignerPublicKey,
      ),
    );
  }

  prepareEd25519Signing(input: PrepareEd25519SigningInput) {
    return this.invoke(() =>
      this.native.prepareEd25519Signing(
        input.transactionXdrBase64,
        input.networkPassphrase,
      ),
    );
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

  registerSignerSystemAuth(input: RegisterSignerSystemAuthInput) {
    return this.invoke(() =>
      this.native.registerSignerSystemAuth(
        input.envelopeJson,
        input.appPasscode,
        input.expectedSignerPublicKey,
      ),
    );
  }

  hasSignerSystemAuth(expectedSignerPublicKey: string) {
    return this.invoke(() =>
      this.native.hasSignerSystemAuth(expectedSignerPublicKey),
    );
  }

  removeSignerSystemAuth(expectedSignerPublicKey: string) {
    return this.invoke(() =>
      this.native.removeSignerSystemAuth(expectedSignerPublicKey),
    );
  }

  removeSystemAuthDomain() {
    return this.invoke(() => this.native.removeSystemAuthDomain());
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

  signWithPasscode(input: SignWithPasscodeInput) {
    return this.invoke(() =>
      this.native.signWithPasscode(
        input.envelopeJson,
        input.appPasscode,
        input.expectedSignerPublicKey,
        input.transactionXdrBase64,
        input.networkPassphrase,
      ),
    );
  }

  private invoke<T>(operation: () => Promise<T>): Promise<T> {
    return operation().catch(error => {
      throw normalizeFresnicaNativeError(error);
    });
  }
}
