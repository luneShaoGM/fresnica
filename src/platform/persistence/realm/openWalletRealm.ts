import Realm from 'realm';
import {
  WALLET_REALM_SCHEMAS,
  WALLET_REALM_SCHEMA_VERSION,
} from './schemas';

export type OpenWalletRealmOptions = {
  path?: string;
};

export function walletRealmConfiguration(
  options: OpenWalletRealmOptions = {},
): Realm.Configuration {
  return {
    ...(options.path ? {path: options.path} : {}),
    schema: [...WALLET_REALM_SCHEMAS],
    schemaVersion: WALLET_REALM_SCHEMA_VERSION,
    onMigration: () => {
      // Schema v1 has no prior Mobile Realm schema to transform.
    },
  };
}

export function openWalletRealm(
  options: OpenWalletRealmOptions = {},
): Promise<Realm> {
  return Realm.open(walletRealmConfiguration(options));
}
