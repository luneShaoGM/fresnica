import Realm from 'realm';
import { BALANCE_CACHE_SNAPSHOT_ENTITY, WALLET_REALM_SCHEMAS, WALLET_REALM_SCHEMA_VERSION } from './schemas';

export type OpenWalletRealmOptions = {
  path?: string;
};

export function walletRealmConfiguration(options: OpenWalletRealmOptions = {}): Realm.Configuration {
  return {
    ...(options.path ? { path: options.path } : {}),
    schema: [...WALLET_REALM_SCHEMAS],
    schemaVersion: WALLET_REALM_SCHEMA_VERSION,
    onMigration: (oldRealm, newRealm) => {
      // Schema v2 added LocalePreferenceEntity; v3 added public-only
      // PendingSubmissionEntity recovery metadata; v4 added network-scoped
      // DefaultAccountPreferenceEntity; v5 adds replaceable History cache snapshots.
      // Existing records require no transformation because each change adds a new
      // top-level entity. Schema v6 adds replaceable Balance display snapshots;
      // v7 adds per-network public dApp catalog snapshots (not permissions).
      // v8 discards a local balance-cache shape that used snapshotJson. That
      // cache is display-only and is loaded again from the network.
      if (oldRealm.schemaVersion < 8 && balanceCacheUsedSnapshotJson(oldRealm)) {
        newRealm.delete(newRealm.objects(BALANCE_CACHE_SNAPSHOT_ENTITY));
      }
    },
  };
}

export function openWalletRealm(options: OpenWalletRealmOptions = {}): Promise<Realm> {
  return Realm.open(walletRealmConfiguration(options));
}

function balanceCacheUsedSnapshotJson(oldRealm: Realm): boolean {
  const schema = oldRealm.schema.find(item => item.name === BALANCE_CACHE_SNAPSHOT_ENTITY);
  return schema !== undefined && Object.prototype.hasOwnProperty.call(schema.properties, 'snapshotJson');
}
