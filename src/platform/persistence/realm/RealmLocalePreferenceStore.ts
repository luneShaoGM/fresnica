import type Realm from 'realm';

import {LOCALE_PREFERENCE_ENTITY} from './schemas';

const LOCALE_PREFERENCE_ID = 'primary';

type PersistedLocalePreference = {
  id: string;
  locale: string;
  updatedAt: Date;
};

export class RealmLocalePreferenceStore {
  constructor(private readonly realm: Realm) {}

  getLocale(): string | undefined {
    const preference = this.realm.objectForPrimaryKey<PersistedLocalePreference>(
      LOCALE_PREFERENCE_ENTITY,
      LOCALE_PREFERENCE_ID,
    );
    return preference?.locale;
  }

  setLocale(locale: string, updatedAt = new Date()): void {
    this.realm.write(() => {
      const preference = this.realm.objectForPrimaryKey<PersistedLocalePreference>(
        LOCALE_PREFERENCE_ENTITY,
        LOCALE_PREFERENCE_ID,
      );

      if (preference) {
        preference.locale = locale;
        preference.updatedAt = updatedAt;
        return;
      }

      this.realm.create(LOCALE_PREFERENCE_ENTITY, {
        id: LOCALE_PREFERENCE_ID,
        locale,
        updatedAt,
      });
    });
  }
}
