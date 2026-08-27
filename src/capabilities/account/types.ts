export type AccountIdentityKind = 'classic' | 'contract';

export type AccountRecord = {
  id: string;
  address: string;
  identityKind: AccountIdentityKind;
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
