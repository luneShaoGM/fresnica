import Realm from 'realm';
import {
  validateGeneralPreferences,
  type GeneralPreferenceStore,
  type GeneralPreferences,
} from '@capabilities/preferences/generalPreferences';
const ENTITY = 'GeneralSettingsEntity';
export const GENERAL_SETTINGS_SCHEMA: Realm.ObjectSchema = {
  name: ENTITY,
  primaryKey: 'id',
  properties: { id: 'string', preferencesJson: 'string' },
};
export class RealmGeneralPreferenceStore implements GeneralPreferenceStore {
  constructor(private readonly realm: Realm) {}
  load(): unknown {
    const record = this.realm.objectForPrimaryKey<{ preferencesJson: string }>(ENTITY, 'primary');
    return record ? JSON.parse(record.preferencesJson) : undefined;
  }
  save(value: GeneralPreferences): void {
    const preferencesJson = JSON.stringify(validateGeneralPreferences(value));
    this.realm.write(() => {
      this.realm.create(ENTITY, { id: 'primary', preferencesJson }, Realm.UpdateMode.Modified);
    });
  }
}
export function openGeneralPreferences(walletPath: string): Promise<Realm> {
  return Realm.open({ path: `${walletPath}.general-settings`, schemaVersion: 1, schema: [GENERAL_SETTINGS_SCHEMA] });
}

// Security policy uses a separate record; presentation updates cannot overwrite it.
export class RealmSecurityPreferenceStore {
  constructor(private readonly realm: Realm) {}
  load(): unknown {
    const row = this.realm.objectForPrimaryKey<{ preferencesJson: string }>(ENTITY, 'security');
    return row ? JSON.parse(row.preferencesJson) : undefined;
  }
  save(value: import('@capabilities/application-security/securitySettings').SecurityPreferences): void {
    const preferencesJson = JSON.stringify(value);
    this.realm.write(() => {
      this.realm.create(ENTITY, { id: 'security', preferencesJson }, Realm.UpdateMode.Modified);
    });
  }
}
