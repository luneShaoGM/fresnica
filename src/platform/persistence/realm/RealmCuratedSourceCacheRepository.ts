import type Realm from 'realm';

import {
  CURATED_CACHE_MAX_JSON_LENGTH,
  CURATED_CACHE_VERSION,
  curatedSourceFor,
  normalizeCuratedSourceSnapshot,
  type CuratedSourceCacheRepository,
  type CuratedSourceSnapshot,
} from '../../../capabilities/trustline/curatedSourceCache';
import type { CuratedAssetSourceId } from '../../../capabilities/trustline/curatedAssetCatalog';
import { CURATED_ASSET_SOURCE_CACHE_ENTITY } from './schemas';

type PersistedSource = Readonly<{
  id: string;
  networkId: string;
  sourceId: string;
  schemaVersion: number;
  savedAt: Date;
  payloadJson: string;
}>;

export class RealmCuratedSourceCacheRepository implements CuratedSourceCacheRepository {
  constructor(private readonly realm: Realm) {}

  read(networkId: string, sourceId: CuratedAssetSourceId): CuratedSourceSnapshot | undefined {
    if (!curatedSourceFor(networkId, sourceId)) return undefined;
    const id = JSON.stringify([networkId, sourceId]);
    const found = this.realm.objectForPrimaryKey(CURATED_ASSET_SOURCE_CACHE_ENTITY, id);
    if (!found) return undefined;
    try {
      const record = found as unknown as PersistedSource;
      if (
        record.id !== id ||
        record.networkId !== networkId ||
        record.sourceId !== sourceId ||
        record.schemaVersion !== CURATED_CACHE_VERSION ||
        record.payloadJson.length > CURATED_CACHE_MAX_JSON_LENGTH ||
        !Number.isFinite(new Date(record.savedAt).getTime())
      )
        return undefined;
      const snapshot = normalizeCuratedSourceSnapshot(JSON.parse(record.payloadJson), networkId, sourceId);
      return snapshot?.savedAtUnixMs === new Date(record.savedAt).getTime() ? snapshot : undefined;
    } catch {
      return undefined;
    }
  }

  replace(snapshot: CuratedSourceSnapshot): void {
    const valid = normalizeCuratedSourceSnapshot(snapshot, snapshot.networkId, snapshot.sourceId);
    if (!valid) throw new Error('curated-source-cache-invalid');
    const payloadJson = JSON.stringify(valid);
    if (payloadJson.length > CURATED_CACHE_MAX_JSON_LENGTH) throw new Error('curated-source-cache-too-large');
    const record: PersistedSource = {
      id: JSON.stringify([valid.networkId, valid.sourceId]),
      networkId: valid.networkId,
      sourceId: valid.sourceId,
      schemaVersion: CURATED_CACHE_VERSION,
      savedAt: new Date(valid.savedAtUnixMs),
      payloadJson,
    };
    this.realm.write(() => {
      const existing = this.realm.objectForPrimaryKey(CURATED_ASSET_SOURCE_CACHE_ENTITY, record.id);
      if (existing) this.realm.delete(existing);
      this.realm.create(CURATED_ASSET_SOURCE_CACHE_ENTITY, record);
    });
  }
}
