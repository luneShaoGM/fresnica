import type Realm from 'realm';
import {
  isDappRecentOrigins,
  type DappRecentRepository,
} from '../../../capabilities/dapp-interaction/dappRecentHistory';
import { DAPP_RECENT_ENTITY } from './schemas';

export class RealmDappRecentRepository implements DappRecentRepository {
  constructor(private readonly realm: Realm) {}

  read(networkId: string): readonly string[] {
    const row = this.realm.objectForPrimaryKey(DAPP_RECENT_ENTITY, networkId);
    if (!row) return [];
    try {
      if (typeof row.originsJson !== 'string' || row.originsJson.length > 21_000) return [];
      const origins: unknown = JSON.parse(row.originsJson);
      return isDappRecentOrigins(origins) ? origins : [];
    } catch {
      return [];
    }
  }

  replace(networkId: string, origins: readonly string[]): void {
    if (!isDappRecentOrigins(origins)) throw new Error('dapp-recent-invalid');
    this.realm.write(() => {
      const existing = this.realm.objectForPrimaryKey(DAPP_RECENT_ENTITY, networkId);
      if (existing) this.realm.delete(existing);
      this.realm.create(DAPP_RECENT_ENTITY, { networkId, originsJson: JSON.stringify(origins) });
    });
  }
}
