export type PersistedAccount = {
  id: string;
  address: string;
  identityKind: string;
  networkId: string;
  label: string;
  sortOrder: number;
  hidden: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type PersistedSigner = {
  id: string;
  publicKey: string;
  kind: string;
  envelopeJson?: string | null;
  envelopeRevision?: string | null;
  recoveryKind?: string | null;
  backupState?: string | null;
  providerId?: string | null;
  providerMetadataJson?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PersistedAccountSignerReference = {
  id: string;
  accountId: string;
  signerId: string;
  createdAt: Date;
};
