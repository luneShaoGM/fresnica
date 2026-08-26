import type {
  AccountIdentity,
  Ed25519SigningRequest,
  GeneratedSigner,
  ProtectedSigner,
  RevealedSigningMaterial,
} from '../types';

export interface NativeFresnicaCoreModule {
  parseAccount(address: string): Promise<AccountIdentity>;
  protectSecret(
    secret: string,
    appPasscode: string,
    expectedSignerPublicKey?: string,
  ): Promise<ProtectedSigner>;
  protectMnemonic(
    mnemonic: string,
    mnemonicPassphrase: string,
    index: number,
    language: string | undefined,
    appPasscode: string,
    expectedSignerPublicKey?: string,
  ): Promise<ProtectedSigner>;
  generateMnemonic(
    language: string,
    strength: number,
    mnemonicPassphrase: string,
    index: number,
    appPasscode: string,
  ): Promise<GeneratedSigner>;
  deriveMnemonicSigner(
    sourceEnvelopeJson: string,
    appPasscode: string,
    expectedSourceSignerPublicKey: string,
    index: number,
  ): Promise<ProtectedSigner>;
  reprotect(
    envelopeJson: string,
    currentPasscode: string,
    newPasscode: string,
    expectedSignerPublicKey: string,
  ): Promise<ProtectedSigner>;
  reveal(
    envelopeJson: string,
    freshAppPasscode: string,
    expectedSignerPublicKey: string,
  ): Promise<RevealedSigningMaterial>;
  prepareEd25519Signing(
    transactionXdrBase64: string,
    networkPassphrase: string,
  ): Promise<Ed25519SigningRequest>;
  applyEd25519Signature(
    transactionXdrBase64: string,
    networkPassphrase: string,
    signerPublicKey: string,
    signatureBase64: string,
  ): Promise<string>;
  canUseSystemAuth(): Promise<boolean>;
  hasSystemAuthDomain(): Promise<boolean>;
  initializeSystemAuth(reason: string): Promise<boolean>;
  registerSignerSystemAuth(
    envelopeJson: string,
    appPasscode: string,
    expectedSignerPublicKey: string,
  ): Promise<boolean>;
  hasSignerSystemAuth(expectedSignerPublicKey: string): Promise<boolean>;
  removeSignerSystemAuth(expectedSignerPublicKey: string): Promise<boolean>;
  removeSystemAuthDomain(): Promise<boolean>;
  signWithSystemAuth(
    envelopeJson: string,
    expectedSignerPublicKey: string,
    transactionXdrBase64: string,
    networkPassphrase: string,
    reason: string,
  ): Promise<string>;
  signWithPasscode(
    envelopeJson: string,
    appPasscode: string,
    expectedSignerPublicKey: string,
    transactionXdrBase64: string,
    networkPassphrase: string,
  ): Promise<string>;
}
