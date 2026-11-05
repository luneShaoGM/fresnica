import type Realm from 'realm';

import {
  DAPP_DETAIL_CACHE_VERSION,
  normalizeDappDetailSnapshot,
  type DappDetailCacheRepository,
  type DappDetailSnapshot,
} from '../../../capabilities/dapp-catalog/dappDetails';
import { DAPP_DETAIL_CACHE_ENTITY } from './schemas';

type Record = Readonly<{
  id: string;
  networkId: string;
  appId: string;
  schemaVersion: number;
  savedAt: Date;
  payloadJson: string;
}>;

// Replaceable public display metadata only: no account, visit history,
// permission grant, site response bytes or wallet authorization material.
export class RealmDappDetailCacheRepository implements DappDetailCacheRepository {
  constructor(private readonly realm: Realm) {}

  read(networkId: string, appId: string): DappDetailSnapshot | undefined {
    const id = JSON.stringify([networkId, appId]);
    const found = this.realm.objectForPrimaryKey(DAPP_DETAIL_CACHE_ENTITY, id);
    if (!found) return;
    try {
      const record = found as unknown as Record;
      if (
        record.id !== id ||
        record.networkId !== networkId ||
        record.appId !== appId ||
        record.schemaVersion !== DAPP_DETAIL_CACHE_VERSION ||
        record.payloadJson.length > 8_192
      )
        return;
      const snapshot = normalizeDappDetailSnapshot(JSON.parse(record.payloadJson), networkId, appId);
      return snapshot?.savedAtUnixMs === record.savedAt.getTime() ? snapshot : undefined;
    } catch {
      return;
    }
  }

  replace(snapshot: DappDetailSnapshot): void {
    const valid = normalizeDappDetailSnapshot(snapshot, snapshot.networkId, snapshot.appId);
    if (!valid) throw new Error('dapp-detail-cache-invalid');
    const id = JSON.stringify([valid.networkId, valid.appId]);
    const record: Record = {
      id,
      networkId: valid.networkId,
      appId: valid.appId,
      schemaVersion: DAPP_DETAIL_CACHE_VERSION,
      savedAt: new Date(valid.savedAtUnixMs),
      payloadJson: JSON.stringify(valid),
    };
    this.realm.write(() => {
      const old = this.realm.objectForPrimaryKey(DAPP_DETAIL_CACHE_ENTITY, id);
      if (old) this.realm.delete(old);
      this.realm.create(DAPP_DETAIL_CACHE_ENTITY, record);
    });
  }
}
