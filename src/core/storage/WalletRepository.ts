import type {
  AccountRecord,
  SignerRecord,
} from './domain/types';

export interface WalletRepository {
  createAccount(account: AccountRecord): void;
  createSigner(signer: SignerRecord): void;
  attachSigner(accountId: string, signerId: string, createdAt: Date): void;
  detachSigner(accountId: string, signerId: string): void;
  deleteAccount(accountId: string): void;
  getAccount(accountId: string): AccountRecord | undefined;
  getSigner(signerId: string): SignerRecord | undefined;
  isWatchOnly(accountId: string): boolean;
}
