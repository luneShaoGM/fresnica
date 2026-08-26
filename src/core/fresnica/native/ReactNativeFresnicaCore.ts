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
import type { NativeFresnicaCoreModule } from './NativeFresnicaCoreModule';

export class ReactNativeFresnicaCore implements FresnicaCore {
  constructor(private readonly native: NativeFresnicaCoreModule) {}

  parseAccount(address: string) {
    return this.native.parseAccount(address);
  }

  protectSecret(input: ProtectSecretInput) {
    return this.native.protectSecret(
      input.secret,
      input.appPasscode,
      input.expectedSignerPublicKey,
    );
  }

  protectMnemonic(input: ProtectMnemonicInput) {
    return this.native.protectMnemonic(
      input.mnemonic,
      input.mnemonicPassphrase,
      input.index,
      input.language,
      input.appPasscode,
      input.expectedSignerPublicKey,
    );
  }

  generateMnemonic(input: GenerateMnemonicInput) {
    return this.native.generateMnemonic(
      input.language,
      input.strength,
      input.mnemonicPassphrase,
      input.index,
      input.appPasscode,
    );
  }

  deriveMnemonicSigner(input: DeriveMnemonicSignerInput) {
    return this.native.deriveMnemonicSigner(
      input.sourceEnvelopeJson,
      input.appPasscode,
      input.expectedSourceSignerPublicKey,
      input.index,
    );
  }

  reprotect(input: ReprotectInput) {
    return this.native.reprotect(
      input.envelopeJson,
      input.currentPasscode,
      input.newPasscode,
      input.expectedSignerPublicKey,
    );
  }

  reveal(input: RevealInput): Promise<RevealedSigningMaterial> {
    return this.native.reveal(
      input.envelopeJson,
      input.freshAppPasscode,
      input.expectedSignerPublicKey,
    );
  }

  prepareEd25519Signing(input: PrepareEd25519SigningInput) {
    return this.native.prepareEd25519Signing(
      input.transactionXdrBase64,
      input.networkPassphrase,
    );
  }

  applyEd25519Signature(input: ApplyEd25519SignatureInput) {
    return this.native.applyEd25519Signature(
      input.transactionXdrBase64,
      input.networkPassphrase,
      input.signerPublicKey,
      input.signatureBase64,
    );
  }

  canUseSystemAuth() {
    return this.native.canUseSystemAuth();
  }

  hasSystemAuthDomain() {
    return this.native.hasSystemAuthDomain();
  }

  initializeSystemAuth(reason: string) {
    return this.native.initializeSystemAuth(reason);
  }

  registerSignerSystemAuth(input: RegisterSignerSystemAuthInput) {
    return this.native.registerSignerSystemAuth(
      input.envelopeJson,
      input.appPasscode,
      input.expectedSignerPublicKey,
    );
  }

  hasSignerSystemAuth(expectedSignerPublicKey: string) {
    return this.native.hasSignerSystemAuth(expectedSignerPublicKey);
  }

  removeSignerSystemAuth(expectedSignerPublicKey: string) {
    return this.native.removeSignerSystemAuth(expectedSignerPublicKey);
  }

  removeSystemAuthDomain() {
    return this.native.removeSystemAuthDomain();
  }

  signWithSystemAuth(input: SignWithSystemAuthInput) {
    return this.native.signWithSystemAuth(
      input.envelopeJson,
      input.expectedSignerPublicKey,
      input.transactionXdrBase64,
      input.networkPassphrase,
      input.reason,
    );
  }

  signWithPasscode(input: SignWithPasscodeInput) {
    return this.native.signWithPasscode(
      input.envelopeJson,
      input.appPasscode,
      input.expectedSignerPublicKey,
      input.transactionXdrBase64,
      input.networkPassphrase,
    );
  }
}
