import type Realm from 'realm';

import { DEFAULT_ACCOUNT_PREFERENCE_ENTITY } from './schemas';

type PersistedDefaultAccountPreference = {
  networkId: string;
  accountId: string;
  updatedAt: Date;
};

export class RealmDefaultAccountPreferenceStore {
  constructor(private readonly realm: Realm) {}

  getDefaultAccountId(networkId: string): string | undefined {
    return this.realm.objectForPrimaryKey<PersistedDefaultAccountPreference>(
      DEFAULT_ACCOUNT_PREFERENCE_ENTITY,
      networkId,
    )?.accountId;
  }

  setDefaultAccountId(networkId: string, accountId: string, updatedAt = new Date()): void {
    this.realm.write(() => {
      const preference = this.realm.objectForPrimaryKey<PersistedDefaultAccountPreference>(
        DEFAULT_ACCOUNT_PREFERENCE_ENTITY,
        networkId,
      );

      if (preference) {
        preference.accountId = accountId;
        preference.updatedAt = updatedAt;
        return;
      }

      this.realm.create(DEFAULT_ACCOUNT_PREFERENCE_ENTITY, {
        networkId,
        accountId,
        updatedAt,
      });
    });
  }

  clearDefaultAccountId(networkId: string): void {
    this.realm.write(() => {
      const preference = this.realm.objectForPrimaryKey<PersistedDefaultAccountPreference>(
        DEFAULT_ACCOUNT_PREFERENCE_ENTITY,
        networkId,
      );
      if (preference) {
        this.realm.delete(preference);
      }
    });
  }
}
