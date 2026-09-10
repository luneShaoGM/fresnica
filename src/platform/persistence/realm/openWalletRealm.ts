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
      // Schema v2 added LocalePreferenceEntity; v3 adds public-only
      // PendingSubmissionEntity recovery metadata. Existing records require no
      // transformation because both additions are new top-level entities.
    },
  };
}

export function openWalletRealm(
  options: OpenWalletRealmOptions = {},
): Promise<Realm> {
  return Realm.open(walletRealmConfiguration(options));
}
