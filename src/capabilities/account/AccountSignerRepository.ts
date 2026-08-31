import type {BackupState, SignerRecord} from '../signer/types';
import type {AccountRecord} from './types';

export type AccountSignerRegistration = {
  account: AccountRecord;
  signer: SignerRecord;
  attachedAt: Date;
};

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
  setSignerBackupState(
    signerId: string,
    backupState: BackupState,
    updatedAt: Date,
  ): void;
  isWatchOnly(accountId: string): boolean;
}
