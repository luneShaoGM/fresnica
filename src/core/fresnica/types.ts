export type CoreCompatibility = {
  nativeBindingApiVersion: number;
  sdkApiVersion: number;
  coreClientApiVersion: number;
};

export type AccountIdentity = {
  address: string;
  kind: 'classic' | 'contract';
};

export type ProtectedSigner = {
  signerPublicKey: string;
  protectedEnvelope: string;
};

export type GeneratedSigner = ProtectedSigner & {
  mnemonic: string;
};

export type GenerateMnemonicInput = {
  language: string;
  strength: number;
  bip39Passphrase: string;
  index: number;
  appPasscode: string;
};

export type ProtectMnemonicInput = {
  mnemonic: string;
  language: string;
  bip39Passphrase: string;
  index: number;
  appPasscode: string;
  expectedSignerPublicKey?: string;
};

export type ProtectSecretInput = {
  secret: string;
  appPasscode: string;
  expectedSignerPublicKey?: string;
};

export type SignProtectedTransactionInput = {
  protectedEnvelope: string;
  expectedSignerPublicKey: string;
  transactionXdr: string;
  networkPassphrase: string;
};

export type ReprotectInput = {
  protectedEnvelope: string;
  currentPasscode: string;
  newPasscode: string;
  expectedSignerPublicKey: string;
};

export type ExportSigningMaterialInput = {
  protectedEnvelope: string;
  freshPasscode: string;
  expectedSignerPublicKey: string;
};

export type ExportedSigningMaterial =
  | { kind: 'mnemonic'; mnemonic: string }
  | { kind: 'secret'; secret: string };
