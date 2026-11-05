import type Realm from 'realm';

import {
  TOKEN_METADATA_SCHEMA_VERSION,
  validateTokenMetadataSnapshot,
  type TokenMetadataRepository,
  type TokenMetadataSnapshot,
} from '../../../capabilities/assets/TokenMetadataCache';
import { TOKEN_METADATA_CACHE_ENTITY } from './schemas';

type Persisted = Readonly<{
  id: string;
  networkId: string;
  code: string;
  issuer: string;
  schemaVersion: number;
  savedAt: Date;
  payloadJson: string;
}>;

export class RealmTokenMetadataRepository implements TokenMetadataRepository {
  constructor(private readonly realm: Realm) {}

  read(networkId: string, code: string, issuer: string): TokenMetadataSnapshot | undefined {
    const id = JSON.stringify([networkId, code, issuer]);
    const found = this.realm.objectForPrimaryKey(TOKEN_METADATA_CACHE_ENTITY, id);
    if (!found) return;
    try {
      const record = found as unknown as Persisted;
      if (
        record.id !== id ||
        record.networkId !== networkId ||
        record.code !== code ||
        record.issuer !== issuer ||
        record.schemaVersion !== TOKEN_METADATA_SCHEMA_VERSION ||
        record.payloadJson.length > 8_192
      )
        return;
      const snapshot = validateTokenMetadataSnapshot(JSON.parse(record.payloadJson), networkId, code, issuer);
      return snapshot?.savedAtUnixMs === record.savedAt.getTime() ? snapshot : undefined;
    } catch {
      return;
    }
  }

  replace(value: TokenMetadataSnapshot): void {
    const snapshot = validateTokenMetadataSnapshot(value, value.networkId, value.code, value.issuer);
    if (!snapshot) throw new Error('token-metadata-invalid');
    const id = JSON.stringify([snapshot.networkId, snapshot.code, snapshot.issuer]);
    const record: Persisted = {
      id,
      networkId: snapshot.networkId,
      code: snapshot.code,
      issuer: snapshot.issuer,
      schemaVersion: TOKEN_METADATA_SCHEMA_VERSION,
      savedAt: new Date(snapshot.savedAtUnixMs),
      payloadJson: JSON.stringify(snapshot),
    };
    this.realm.write(() => {
      const prior = this.realm.objectForPrimaryKey(TOKEN_METADATA_CACHE_ENTITY, id);
      if (prior) this.realm.delete(prior);
      this.realm.create(TOKEN_METADATA_CACHE_ENTITY, record);
    });
  }
}
