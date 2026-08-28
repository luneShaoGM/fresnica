import type Realm from 'realm';
import type {
  AccountSignerRegistration,
  AccountSignerRepository,
} from '../../../capabilities/account/AccountSignerRepository';
import type {AccountRecord} from '../../../capabilities/account/types';
import type {SignerRecord} from '../../../capabilities/signer/types';
import {
  mapAccountFromRealm,
  mapSignerFromRealm,
} from './mappers';
import {
  ACCOUNT_ENTITY,
  ACCOUNT_SIGNER_REFERENCE_ENTITY,
  SIGNER_ENTITY,
} from './schemas';
import type {PersistedAccount, PersistedSigner} from './types';

export class RealmAccountSignerRepository implements AccountSignerRepository {
  constructor(private readonly realm: Realm) {}

  createAccount(account: AccountRecord): void {
    this.realm.write(() => {
      this.assertAccountIdentityAvailable(account);
      this.realm.create(ACCOUNT_ENTITY, account);
    });
  }

  createSigner(signer: SignerRecord): void {
    this.realm.write(() => {
      this.realm.create(SIGNER_ENTITY, this.toPersistedSigner(signer));
    });
  }

  createAccountWithSigner(registration: AccountSignerRegistration): void {
    const {account, signer, attachedAt} = registration;
    const referenceId = this.referenceId(account.id, signer.id);

    this.realm.write(() => {
      this.assertAccountIdentityAvailable(account);
      this.realm.create(ACCOUNT_ENTITY, account);
      this.realm.create(SIGNER_ENTITY, this.toPersistedSigner(signer));
      this.realm.create(ACCOUNT_SIGNER_REFERENCE_ENTITY, {
        id: referenceId,
        accountId: account.id,
        signerId: signer.id,
        createdAt: attachedAt,
      });
    });
  }

  attachSigner(accountId: string, signerId: string, createdAt: Date): void {
    const id = this.referenceId(accountId, signerId);

    this.realm.write(() => {
      if (!this.realm.objectForPrimaryKey(ACCOUNT_ENTITY, accountId)) {
        throw new Error('account-not-found');
      }
      if (!this.realm.objectForPrimaryKey(SIGNER_ENTITY, signerId)) {
        throw new Error('signer-not-found');
      }

      this.realm.create(ACCOUNT_SIGNER_REFERENCE_ENTITY, {
        id,
        accountId,
        signerId,
        createdAt,
      });
    });
  }

  detachSigner(accountId: string, signerId: string): void {
    this.realm.write(() => {
      const reference = this.realm.objectForPrimaryKey(
        ACCOUNT_SIGNER_REFERENCE_ENTITY,
        this.referenceId(accountId, signerId),
      );

      if (reference) {
        this.realm.delete(reference);
      }
      this.deleteOrphanSigners();
    });
  }

  deleteAccount(accountId: string): void {
    this.realm.write(() => {
      const account = this.realm.objectForPrimaryKey(ACCOUNT_ENTITY, accountId);
      const references = this.realm
        .objects(ACCOUNT_SIGNER_REFERENCE_ENTITY)
        .filtered('accountId == $0', accountId);

      if (account) {
        this.realm.delete(account);
      }
      this.realm.delete(references);
      this.deleteOrphanSigners();
    });
  }

  getAccount(accountId: string): AccountRecord | undefined {
    const record = this.realm.objectForPrimaryKey(ACCOUNT_ENTITY, accountId);
    return record
      ? mapAccountFromRealm(record as unknown as PersistedAccount)
      : undefined;
  }

  getSigner(signerId: string): SignerRecord | undefined {
    const record = this.realm.objectForPrimaryKey(SIGNER_ENTITY, signerId);
    return record
      ? mapSignerFromRealm(record as unknown as PersistedSigner)
      : undefined;
  }

  isWatchOnly(accountId: string): boolean {
    return (
      this.realm
        .objects(ACCOUNT_SIGNER_REFERENCE_ENTITY)
        .filtered('accountId == $0', accountId).length === 0
    );
  }

  private assertAccountIdentityAvailable(account: AccountRecord): void {
    const duplicate = this.realm
      .objects(ACCOUNT_ENTITY)
      .filtered(
        'networkId == $0 AND address == $1',
        account.networkId,
        account.address,
      ).length;

    if (duplicate > 0) {
      throw new Error('duplicate-account-identity');
    }
  }

  private toPersistedSigner(signer: SignerRecord) {
    return {
      ...signer,
      envelopeJson: signer.envelopeJson ?? null,
      envelopeRevision: signer.envelopeRevision ?? null,
      recoveryKind: signer.recoveryKind ?? null,
      backupState: signer.backupState ?? null,
      providerId: signer.providerId ?? null,
      providerMetadataJson: signer.providerMetadataJson ?? null,
    };
  }

  private deleteOrphanSigners(): void {
    const signers = Array.from(this.realm.objects(SIGNER_ENTITY));

    for (const signer of signers) {
      const signerId = String((signer as unknown as {id: string}).id);
      const references = this.realm
        .objects(ACCOUNT_SIGNER_REFERENCE_ENTITY)
        .filtered('signerId == $0', signerId);

      if (references.length === 0) {
        this.realm.delete(signer);
      }
    }
  }

  private referenceId(accountId: string, signerId: string): string {
    return `${accountId}:${signerId}`;
  }
}
