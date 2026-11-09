import type Realm from 'realm';
import type { ClaimableCacheStore } from '../../../capabilities/claimable/createClaimableProduct';
import {
  CLAIMABLE_SNAPSHOT_VERSION,
  parseClaimableSnapshot,
  validClaimableId,
  type ClaimableSnapshot,
} from '../../../capabilities/claimable/records';
import { CLAIMABLE_CACHE_ENTITY, CLAIMABLE_RISK_OVERRIDE_ENTITY } from './schemas';

type ClaimableCacheRow = {
  id: string;
  networkId: string;
  accountAddress: string;
  version: number;
  savedAt: Date;
  payloadJson: string;
};
type RiskRow = { id: string; networkId: string; accountAddress: string; balanceId: string; hidden: boolean };
const MAX_SNAPSHOT_BYTES = 1_200_000;

export class RealmClaimableCacheStore implements ClaimableCacheStore {
  constructor(private readonly realm: Realm) {}
  private partition(networkId: string, address: string) {
    return JSON.stringify([networkId, address]);
  }
  private overrideKey(networkId: string, address: string, id: string) {
    return JSON.stringify([networkId, address, id]);
  }
  read(networkId: string, accountAddress: string): ClaimableSnapshot | undefined {
    const id = this.partition(networkId, accountAddress);
    const found = this.realm.objectForPrimaryKey(CLAIMABLE_CACHE_ENTITY, id);
    if (!found) return undefined;
    try {
      const row = found as unknown as ClaimableCacheRow;
      if (
        row.version !== CLAIMABLE_SNAPSHOT_VERSION ||
        row.id !== id ||
        row.networkId !== networkId ||
        row.accountAddress !== accountAddress ||
        row.payloadJson.length > MAX_SNAPSHOT_BYTES
      )
        return undefined;
      const snapshot = parseClaimableSnapshot(JSON.parse(row.payloadJson), networkId, accountAddress);
      return snapshot?.savedAt === row.savedAt.getTime() ? snapshot : undefined;
    } catch {
      return undefined;
    }
  }
  replace(snapshot: ClaimableSnapshot): void {
    const valid = parseClaimableSnapshot(snapshot, snapshot.networkId, snapshot.address);
    if (!valid) throw new Error('claimable-snapshot-invalid');
    const payloadJson = JSON.stringify(valid);
    if (payloadJson.length > MAX_SNAPSHOT_BYTES) throw new Error('claimable-snapshot-too-large');
    const row: ClaimableCacheRow = {
      id: this.partition(valid.networkId, valid.address),
      networkId: valid.networkId,
      accountAddress: valid.address,
      version: CLAIMABLE_SNAPSHOT_VERSION,
      savedAt: new Date(valid.savedAt),
      payloadJson,
    };
    this.realm.write(() => {
      const old = this.realm.objectForPrimaryKey(CLAIMABLE_CACHE_ENTITY, row.id);
      if (old) this.realm.delete(old);
      this.realm.create(CLAIMABLE_CACHE_ENTITY, row);
    });
  }
  userSpam(networkId: string, address: string, id: string): boolean | undefined {
    const item = this.realm.objectForPrimaryKey(
      CLAIMABLE_RISK_OVERRIDE_ENTITY,
      this.overrideKey(networkId, address, id),
    );
    if (!item) return undefined;
    const row = item as unknown as RiskRow;
    return row.networkId === networkId && row.accountAddress === address && row.balanceId === id
      ? row.hidden
      : undefined;
  }
  setUserSpam(networkId: string, address: string, id: string, hidden: boolean): void {
    if (
      !validClaimableId(id) ||
      !/^G[A-Z2-7]{55}$/.test(address) ||
      (networkId !== 'stellar-mainnet' && networkId !== 'stellar-testnet')
    )
      throw new Error('claimable-risk-override-invalid');
    const row: RiskRow = {
      id: this.overrideKey(networkId, address, id),
      networkId,
      accountAddress: address,
      balanceId: id,
      hidden,
    };
    this.realm.write(() => this.realm.create(CLAIMABLE_RISK_OVERRIDE_ENTITY, row, true));
  }
}
