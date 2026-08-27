import type { AccountSignerRepository } from '../../../capabilities/account/AccountSignerRepository';
import {
  findOrphanSignerIds,
  isWatchOnly as deriveWatchOnly,
} from '../../../capabilities/account/walletInvariants';
import type {
  AccountRecord,
  AccountSignerReference,
} from '../../../capabilities/account/types';
import type { SignerRecord } from '../../../capabilities/signer/types';

export class InMemoryAccountSignerRepository implements AccountSignerRepository {
  private readonly accounts = new Map<string, AccountRecord>();
  private readonly signers = new Map<string, SignerRecord>();
  private readonly references = new Map<string, AccountSignerReference>();

  createAccount(account: AccountRecord): void {
    const duplicate = [...this.accounts.values()].some(
      existing =>
        existing.networkId === account.networkId &&
        existing.address === account.address,
    );

    if (duplicate) {
      throw new Error('duplicate-account-identity');
    }

    this.accounts.set(account.id, account);
  }

  createSigner(signer: SignerRecord): void {
    this.signers.set(signer.id, signer);
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

  isWatchOnly(accountId: string): boolean {
    return deriveWatchOnly(accountId, [...this.references.values()]);
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
