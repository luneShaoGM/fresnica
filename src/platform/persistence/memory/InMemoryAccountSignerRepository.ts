import type {
  AccountSignerRegistration,
  AccountSignerRepository,
} from '../../../capabilities/account/AccountSignerRepository';
import {
  findOrphanSignerIds,
  isWatchOnly as deriveWatchOnly,
} from '../../../capabilities/account/walletInvariants';
import type {
  AccountRecord,
  AccountSignerReference,
} from '../../../capabilities/account/types';
import type {
  BackupState,
  SignerRecord,
} from '../../../capabilities/signer/types';

export class InMemoryAccountSignerRepository implements AccountSignerRepository {
  private readonly accounts = new Map<string, AccountRecord>();
  private readonly signers = new Map<string, SignerRecord>();
  private readonly references = new Map<string, AccountSignerReference>();

  createAccount(account: AccountRecord): void {
    this.assertAccountIdentityAvailable(account);
    this.accounts.set(account.id, account);
  }

  createSigner(signer: SignerRecord): void {
    this.signers.set(signer.id, signer);
  }

  createAccountWithSigner(registration: AccountSignerRegistration): void {
    const {account, signer, attachedAt} = registration;
    this.assertAccountIdentityAvailable(account);

    const referenceId = this.referenceId(account.id, signer.id);
    this.accounts.set(account.id, account);
    this.signers.set(signer.id, signer);
    this.references.set(referenceId, {
      id: referenceId,
      accountId: account.id,
      signerId: signer.id,
      createdAt: attachedAt,
    });
  }

  attachSigner(accountId: string, signerId: string, createdAt: Date): void {
    if (!this.accounts.has(accountId)) {
      throw new Error('account-not-found');
    }

    if (!this.signers.has(signerId)) {
      throw new Error('signer-not-found');
    }

    const id = this.referenceId(accountId, signerId);
    this.references.set(id, { id, accountId, signerId, createdAt });
  }

  detachSigner(accountId: string, signerId: string): void {
    this.references.delete(this.referenceId(accountId, signerId));
    this.deleteOrphanSigners();
  }

  deleteAccount(accountId: string): void {
    this.accounts.delete(accountId);

    for (const [id, reference] of this.references.entries()) {
      if (reference.accountId === accountId) {
        this.references.delete(id);
      }
    }

    this.deleteOrphanSigners();
  }

  getAccount(accountId: string): AccountRecord | undefined {
    return this.accounts.get(accountId);
  }

  getSigner(signerId: string): SignerRecord | undefined {
    return this.signers.get(signerId);
  }

  listAccounts(): AccountRecord[] {
    return [...this.accounts.values()];
  }

  listSigners(): SignerRecord[] {
    return [...this.signers.values()];
  }

  setSignerBackupState(
    signerId: string,
    backupState: BackupState,
    updatedAt: Date,
  ): void {
    const signer = this.signers.get(signerId);
    if (!signer) {
      throw new Error('signer-not-found');
    }

    this.signers.set(signerId, {...signer, backupState, updatedAt});
  }

  isWatchOnly(accountId: string): boolean {
    return deriveWatchOnly(accountId, [...this.references.values()]);
  }

  private assertAccountIdentityAvailable(account: AccountRecord): void {
    const duplicate = [...this.accounts.values()].some(
      existing =>
        existing.networkId === account.networkId &&
        existing.address === account.address,
    );

    if (duplicate) {
      throw new Error('duplicate-account-identity');
    }
  }

  private deleteOrphanSigners(): void {
    const orphanIds = findOrphanSignerIds(
      [...this.signers.values()],
      [...this.references.values()],
    );

    for (const signerId of orphanIds) {
      this.signers.delete(signerId);
    }
  }

  private referenceId(accountId: string, signerId: string): string {
    return `${accountId}:${signerId}`;
  }
}
