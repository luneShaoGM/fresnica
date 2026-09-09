export type AccountIdentity = {
  address: string;
  kind: 'classic' | 'contract';
  publicKey?: string;
};

export type ProtectedSigner = {
  signerPublicKey: string;
  envelopeJson: string;
};

export type GeneratedSigner = {
  signer: ProtectedSigner;
  mnemonic: string;
  language: string;
  index: number;
};

export type ProtectSecretInput = {
  secret: string;
  appPassphrase: string;
  expectedSignerPublicKey?: string;
};

export type ProtectMnemonicInput = {
  mnemonic: string;
  mnemonicPassphrase: string;
  index: number;
  language?: string;
  appPassphrase: string;
  expectedSignerPublicKey?: string;
};

export type GenerateMnemonicInput = {
  language: string;
  strength: number;
  mnemonicPassphrase: string;
  index: number;
  appPassphrase: string;
};

export type DeriveMnemonicSignerInput = {
  sourceEnvelopeJson: string;
  appPassphrase: string;
  expectedSourceSignerPublicKey: string;
  index: number;
};

export type ReprotectInput = {
  envelopeJson: string;
  currentPassphrase: string;
  newPassphrase: string;
  expectedSignerPublicKey: string;
};

export type RevealInput = {
  envelopeJson: string;
  freshAppPassphrase: string;
  expectedSignerPublicKey: string;
};

export type RevealedSigningMaterial =
  | {
      kind: 'secret';
      secret: string;
    }
  | {
      kind: 'mnemonic';
      mnemonic: string;
      mnemonicPassphrase?: string;
      index?: number;
      language?: string;
    };

export type PrepareEd25519SigningInput = {
  transactionXdrBase64: string;
  networkPassphrase: string;
};

export type Ed25519SigningRequest = {
  transactionHashBase64: string;
  transactionXdrBase64: string;
  networkPassphrase: string;
};

export type ApplyEd25519SignatureInput = {
  transactionXdrBase64: string;
  networkPassphrase: string;
  signerPublicKey: string;
  signatureBase64: string;
};

export type RegisterSignerSystemAuthInput = {
  envelopeJson: string;
  appPassphrase: string;
  expectedSignerPublicKey: string;
};

export type SignMessageWithSystemAuthInput = {
  envelopeJson: string;
  expectedSignerPublicKey: string;
  message: string;
  reason: string;
};

export type SignMessageWithPassphraseInput = {
  envelopeJson: string;
  appPassphrase: string;
  expectedSignerPublicKey: string;
  message: string;
};

export type SignWithSystemAuthInput = {
  envelopeJson: string;
  expectedSignerPublicKey: string;
  transactionXdrBase64: string;
  networkPassphrase: string;
  reason: string;
};

export type SignWithPassphraseInput = {
  envelopeJson: string;
  appPassphrase: string;
  expectedSignerPublicKey: string;
  transactionXdrBase64: string;
  networkPassphrase: string;
};
