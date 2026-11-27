import type Realm from 'realm';
import {
  validContractTokenRecord,
  type ContractAssetStore,
  type ContractTokenRecord,
} from '@capabilities/assets/contractAssets';
import { walletAssetKey } from '@capabilities/assets/walletAssetIdentity';
import { CONTRACT_ASSET_ENTITY } from './schemas';

type Row = { id: string; networkId: string; accountAddress: string; contractId: string; payloadJson: string };
const idFor = (networkId: string, accountAddress: string, contractId: string) =>
  JSON.stringify([accountAddress, walletAssetKey(networkId, { kind: 'contract', contractId })]);
function project(value: ContractTokenRecord): ContractTokenRecord {
  return {
    networkId: value.networkId,
    accountAddress: value.accountAddress,
    contractId: value.contractId,
    metadata: { name: value.metadata.name, symbol: value.metadata.symbol, decimals: value.metadata.decimals },
    trackedAt: value.trackedAt,
    attemptedAt: value.attemptedAt,
    balanceUnavailable: value.balanceUnavailable,
    ...(value.balance
      ? {
          balance: {
            baseUnits: value.balance.baseUnits,
            ledger: value.balance.ledger,
            observedAt: value.balance.observedAt,
          },
        }
      : {}),
  };
}

export class RealmContractAssetStore implements ContractAssetStore {
  constructor(private readonly realm: Realm) {}
  private parse(row: Row): ContractTokenRecord | undefined {
    try {
      if (row.payloadJson.length > 4096 || row.id !== idFor(row.networkId, row.accountAddress, row.contractId)) return;
      const record = JSON.parse(row.payloadJson) as ContractTokenRecord;
      if (
        !validContractTokenRecord(record) ||
        record.networkId !== row.networkId ||
        record.accountAddress !== row.accountAddress ||
        record.contractId !== row.contractId
      )
        return;
      return project(record);
    } catch {
      return;
    }
  }
  list(networkId: string, accountAddress: string): readonly ContractTokenRecord[] {
    return Array.from(
      this.realm
        .objects(CONTRACT_ASSET_ENTITY)
        .filtered('networkId == $0 AND accountAddress == $1', networkId, accountAddress),
    )
      .flatMap(found => {
        const record = this.parse(found as unknown as Row);
        return record ? [record] : [];
      })
      .sort((a, b) => a.trackedAt - b.trackedAt || a.contractId.localeCompare(b.contractId));
  }
  get(networkId: string, accountAddress: string, contractId: string): ContractTokenRecord | undefined {
    const row = this.realm.objectForPrimaryKey(CONTRACT_ASSET_ENTITY, idFor(networkId, accountAddress, contractId));
    return row ? this.parse(row as unknown as Row) : undefined;
  }
  replace(record: ContractTokenRecord): void {
    if (!validContractTokenRecord(record)) throw new Error('contract-record-invalid');
    const value = project(record);
    const row: Row = {
      id: idFor(value.networkId, value.accountAddress, value.contractId),
      networkId: value.networkId,
      accountAddress: value.accountAddress,
      contractId: value.contractId,
      payloadJson: JSON.stringify(value),
    };
    this.realm.write(() => this.realm.create(CONTRACT_ASSET_ENTITY, row, true));
  }
  remove(networkId: string, accountAddress: string, contractId: string): void {
    this.realm.write(() => {
      const row = this.realm.objectForPrimaryKey(CONTRACT_ASSET_ENTITY, idFor(networkId, accountAddress, contractId));
      if (row) this.realm.delete(row);
    });
  }
  clearPartition(networkId: string, accountAddress: string): void {
    this.realm.write(() =>
      this.realm.delete(
        this.realm
          .objects(CONTRACT_ASSET_ENTITY)
          .filtered('networkId == $0 AND accountAddress == $1', networkId, accountAddress),
      ),
    );
  }
}
