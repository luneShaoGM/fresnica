import Realm from 'realm';
import {
  validateNetworkPreferences,
  type NetworkPreferences,
  type NetworkPreferenceStore,
} from '@capabilities/network/networkPreferences';

const ENTITY = 'NetworkSettingsEntity';
export const NETWORK_SETTINGS_SCHEMA: Realm.ObjectSchema = {
  name: ENTITY,
  primaryKey: 'id',
  properties: { id: 'string', preferencesJson: 'string' },
};
export class RealmNetworkPreferenceStore implements NetworkPreferenceStore {
  constructor(private readonly realm: Realm) {}
  load(): NetworkPreferences | undefined {
    const record = this.realm.objectForPrimaryKey<{ preferencesJson: string }>(ENTITY, 'primary');
    return record ? validateNetworkPreferences(JSON.parse(record.preferencesJson)) : undefined;
  }
  save(value: NetworkPreferences) {
    const preferencesJson = JSON.stringify(validateNetworkPreferences(value));
    this.realm.write(() => {
      this.realm.create(ENTITY, { id: 'primary', preferencesJson }, Realm.UpdateMode.Modified);
    });
  }
}
export function openNetworkPreferences(walletPath: string) {
  return Realm.open({ path: `${walletPath}.network-settings`, schemaVersion: 1, schema: [NETWORK_SETTINGS_SCHEMA] });
}
