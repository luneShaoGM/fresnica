import type {BackupState, SignerRecord} from '../signer/types';
import type {AccountRecord} from './types';

export type AccountSignerRegistration = {
  account: AccountRecord;
  signer: SignerRecord;
  attachedAt: Date;
};

export type AccountSortOrderUpdate = Readonly<{
  accountId: string;
  sortOrder: number;
  updatedAt: Date;
}>;

export interface AccountSignerRepository {
  createAccount(account: AccountRecord): void;
  createSigner(signer: SignerRecord): void;
  createAccountWithSigner(registration: AccountSignerRegistration): void;
  attachSigner(accountId: string, signerId: string, createdAt: Date): void;
  detachSigner(accountId: string, signerId: string): void;
  deleteAccount(accountId: string): void;
  getAccount(accountId: string): AccountRecord | undefined;
  getSigner(signerId: string): SignerRecord | undefined;
  listAccounts(): AccountRecord[];
  listSigners(): SignerRecord[];
  listSignersForAccount(accountId: string): SignerRecord[];
  setAccountLabel(accountId: string, label: string, updatedAt: Date): void;
  setAccountHidden(accountId: string, hidden: boolean, updatedAt: Date): void;
  setAccountSortOrders(updates: readonly AccountSortOrderUpdate[]): void;
  setSignerBackupState(
    signerId: string,
    backupState: BackupState,
    updatedAt: Date,
  ): void;
  isWatchOnly(accountId: string): boolean;
}
