export type AccountIdentityKind = 'classic' | 'contract';

export type AccountRecord = {
  id: string;
  address: string;
  identityKind: AccountIdentityKind;
  // Stored registration network; the session repository supplies the current Classic account context.
  networkId: string;
  label: string;
  sortOrder: number;
  hidden: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type AccountSignerReference = {
  id: string;
  accountId: string;
  signerId: string;
  createdAt: Date;
};
