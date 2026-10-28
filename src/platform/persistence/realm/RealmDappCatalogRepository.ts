import type Realm from 'realm';

import {
  DAPP_CATALOG_CACHE_VERSION,
  normalizeDappCatalogCache,
  type DappCatalogCacheRepository,
  type DappCatalogCacheSnapshot,
} from '../../../capabilities/dapp-catalog/catalogCache';
import { DAPP_CATALOG_CACHE_ENTITY } from './schemas';

const MAX_PAYLOAD_LENGTH = 1_500_000;

type PersistedCatalog = Readonly<{
  networkId: string;
  schemaVersion: number;
  savedAt: Date;
  payloadJson: string;
}>;

// Public, replaceable cache. No account, signer, visit URLs or permission grants.
export class RealmDappCatalogRepository implements DappCatalogCacheRepository {
  constructor(private readonly realm: Realm) {}

  read(networkId: string): DappCatalogCacheSnapshot | undefined {
    const object = this.realm.objectForPrimaryKey(DAPP_CATALOG_CACHE_ENTITY, networkId);
    if (!object) return undefined;
    try {
      const record = object as unknown as PersistedCatalog;
      if (record.schemaVersion !== DAPP_CATALOG_CACHE_VERSION || record.payloadJson.length > MAX_PAYLOAD_LENGTH)
        return undefined;
      return normalizeDappCatalogCache(JSON.parse(record.payloadJson), networkId);
    } catch {
      return undefined;
    }
  }

  replace(snapshot: DappCatalogCacheSnapshot): void {
    const validated = normalizeDappCatalogCache(snapshot, snapshot.networkId);
    if (!validated) throw new Error('dapp-catalog-cache-invalid');
    const payloadJson = JSON.stringify(validated);
    if (payloadJson.length > MAX_PAYLOAD_LENGTH) throw new Error('dapp-catalog-cache-too-large');
    const record: PersistedCatalog = {
      networkId: validated.networkId,
      schemaVersion: DAPP_CATALOG_CACHE_VERSION,
      savedAt: new Date(validated.savedAtUnixMs),
      payloadJson,
    };
    this.realm.write(() => {
      const existing = this.realm.objectForPrimaryKey(DAPP_CATALOG_CACHE_ENTITY, record.networkId);
      if (existing) this.realm.delete(existing);
      this.realm.create(DAPP_CATALOG_CACHE_ENTITY, record);
    });
  }
}
