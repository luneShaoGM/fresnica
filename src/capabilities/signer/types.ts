export type SignerKind = 'protected-software' | 'hardware' | 'external';
export type RecoveryKind = 'mnemonic' | 'secret';
export type BackupState = 'pending' | 'confirmed' | 'not-required';

export type SignerRecord = {
  id: string;
  publicKey: string;
  kind: SignerKind;
  envelopeJson?: string;
  envelopeRevision?: string;
  recoveryKind?: RecoveryKind;
  backupState?: BackupState;
  providerId?: string;
  providerMetadataJson?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type SecureCleanupReason =
  | 'signer-deleted'
  | 'envelope-reprotected';

export type SecureCleanupTask = {
  id: string;
  signerId: string;
  envelopeRevision: string;
  reason: SecureCleanupReason;
  createdAt: Date;
  attempts: number;
};
