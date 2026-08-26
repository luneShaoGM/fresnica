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
  appPasscode: string;
  expectedSignerPublicKey?: string;
};

export type ProtectMnemonicInput = {
  mnemonic: string;
  mnemonicPassphrase: string;
  index: number;
  language?: string;
  appPasscode: string;
  expectedSignerPublicKey?: string;
};

export type GenerateMnemonicInput = {
  language: string;
  strength: number;
  mnemonicPassphrase: string;
  index: number;
  appPasscode: string;
};

export type DeriveMnemonicSignerInput = {
  sourceEnvelopeJson: string;
  appPasscode: string;
  expectedSourceSignerPublicKey: string;
  index: number;
};

export type ReprotectInput = {
  envelopeJson: string;
  currentPasscode: string;
  newPasscode: string;
  expectedSignerPublicKey: string;
};

export type RevealInput = {
  envelopeJson: string;
  freshAppPasscode: string;
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
  appPasscode: string;
  expectedSignerPublicKey: string;
};

export type SignWithSystemAuthInput = {
  envelopeJson: string;
  expectedSignerPublicKey: string;
  transactionXdrBase64: string;
  networkPassphrase: string;
  reason: string;
};

export type SignWithPasscodeInput = {
  envelopeJson: string;
  appPasscode: string;
  expectedSignerPublicKey: string;
  transactionXdrBase64: string;
  networkPassphrase: string;
};
