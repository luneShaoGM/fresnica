import type {
  AccountIdentity,
  ApplyEd25519SignatureInput,
  DeriveMnemonicSignerInput,
  Ed25519SigningRequest,
  GeneratedSigner,
  GenerateMnemonicInput,
  PrepareEd25519SigningInput,
  ProtectedSigner,
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
} from './fresnicaTypes';

export interface FresnicaSdkPort {
  parseAccount(address: string): Promise<AccountIdentity>;
  protectSecret(input: ProtectSecretInput): Promise<ProtectedSigner>;
  protectMnemonic(input: ProtectMnemonicInput): Promise<ProtectedSigner>;
  generateMnemonic(input: GenerateMnemonicInput): Promise<GeneratedSigner>;
  deriveMnemonicSigner(input: DeriveMnemonicSignerInput): Promise<ProtectedSigner>;
  reprotect(input: ReprotectInput): Promise<ProtectedSigner>;
  reveal(input: RevealInput): Promise<RevealedSigningMaterial>;
  prepareEd25519Signing(input: PrepareEd25519SigningInput): Promise<Ed25519SigningRequest>;
  applyEd25519Signature(input: ApplyEd25519SignatureInput): Promise<string>;
  canUseSystemAuth(): Promise<boolean>;
  hasSystemAuthDomain(): Promise<boolean>;
  initializeSystemAuth(reason: string): Promise<boolean>;
  registerSignerSystemAuth(input: RegisterSignerSystemAuthInput): Promise<boolean>;
  hasSignerSystemAuth(expectedSignerPublicKey: string): Promise<boolean>;
  removeSignerSystemAuth(expectedSignerPublicKey: string): Promise<boolean>;
  removeSystemAuthDomain(): Promise<boolean>;
  signMessageWithSystemAuth(input: SignMessageWithSystemAuthInput): Promise<string>;
  signMessageWithPassphrase(input: SignMessageWithPassphraseInput): Promise<string>;
  signWithSystemAuth(input: SignWithSystemAuthInput): Promise<string>;
  signWithPassphrase(input: SignWithPassphraseInput): Promise<string>;
}
