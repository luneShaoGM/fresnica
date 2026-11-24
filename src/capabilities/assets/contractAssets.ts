import type { AccountSignerRepository } from '../account/AccountSignerRepository';
import type { AccountRecord } from '../account/types';
import type { BalanceAsset } from '../balance/types';
import { NETWORKS, type NetworkId } from '../network/networkPreferences';
import type { NetworkContext } from '../network/types';
import { walletAssetKey } from './walletAssetIdentity';

export type ContractTokenMetadata = Readonly<{ name: string; symbol: string; decimals: number }>;
export type ContractBalanceObservation = Readonly<{ baseUnits: string; ledger: number; observedAt: number }>;
export type ContractTokenRecord = Readonly<{
  networkId: NetworkId;
  accountAddress: string;
  contractId: string;
  metadata: ContractTokenMetadata;
  trackedAt: number;
  attemptedAt: number;
  balance?: ContractBalanceObservation;
  balanceUnavailable: boolean;
}>;
export type ContractTokenRead = Readonly<{
  metadata: ContractTokenMetadata;
  balance?: Readonly<{ baseUnits: string; ledger: number }>;
}>;
export interface ContractTokenReadPort {
  readonly network: NetworkContext;
  isContractId(value: string): boolean;
  isClassicAddress(value: string): boolean;
  classicContractId?(asset: BalanceAsset): string;
  readToken(contractId: string, accountAddress: string, signal: AbortSignal): Promise<ContractTokenRead>;
}
export interface ContractAssetStore {
  list(networkId: string, accountAddress: string): readonly ContractTokenRecord[];
  get(networkId: string, accountAddress: string, contractId: string): ContractTokenRecord | undefined;
  replace(record: ContractTokenRecord): void;
  remove(networkId: string, accountAddress: string, contractId: string): void;
  clearPartition(networkId: string, accountAddress: string): void;
}

const MAX_CONTRACT_BALANCE = 2n ** 127n - 1n;
const MAX_TRACKED = 50;
const safeText = (value: string, max: number) =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= max &&
  value.trim() === value &&
  !/[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/.test(value) &&
  Array.from(value).every(character => {
    const point = character.codePointAt(0)!;
    return point >= 32 && (point < 127 || point > 159);
  });

export function validContractMetadata(value: ContractTokenMetadata): boolean {
  return (
    !!value &&
    safeText(value.name, 128) &&
    safeText(value.symbol, 32) &&
    Number.isInteger(value.decimals) &&
    value.decimals >= 0 &&
    value.decimals <= 38
  );
}
export function validContractBaseUnits(value: string): boolean {
  return typeof value === 'string' && /^(0|[1-9]\d{0,38})$/.test(value) && BigInt(value) <= MAX_CONTRACT_BALANCE;
}
function validTime(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}
function validLedger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

export function validContractTokenRecord(record: ContractTokenRecord): boolean {
  return (
    (record.networkId === 'stellar-mainnet' || record.networkId === 'stellar-testnet') &&
    /^G[A-Z2-7]{55}$/.test(record.accountAddress) &&
    /^C[A-Z2-7]{55}$/.test(record.contractId) &&
    validContractMetadata(record.metadata) &&
    validTime(record.trackedAt) &&
    validTime(record.attemptedAt) &&
    record.trackedAt <= record.attemptedAt &&
    typeof record.balanceUnavailable === 'boolean' &&
    (record.balance
      ? validContractBaseUnits(record.balance.baseUnits) &&
        validLedger(record.balance.ledger) &&
        validTime(record.balance.observedAt) &&
        record.balance.observedAt >= record.trackedAt &&
        record.balance.observedAt <= record.attemptedAt
      : record.balanceUnavailable)
  );
}

export function formatContractBalance(baseUnits: string, decimals: number): string | undefined {
  if (!validContractBaseUnits(baseUnits) || !Number.isInteger(decimals) || decimals < 0 || decimals > 38) return;
  if (decimals === 0) return baseUnits;
  const padded = baseUnits.padStart(decimals + 1, '0');
  const fraction = padded.slice(-decimals).replace(/0+$/, '');
  return padded.slice(0, -decimals) + (fraction ? '.' + fraction : '');
}

export type ContractAssets = ReturnType<typeof createContractAssets>;

export function createContractAssets(
  deps: Readonly<{
    reader: ContractTokenReadPort;
    store: ContractAssetStore;
    repository: Pick<AccountSignerRepository, 'getAccount'>;
    now: () => number;
    assertOpen: () => void;
  }>,
) {
  const pending = new Map<string, object>();
  const current = (account: AccountRecord): NetworkId => {
    deps.assertOpen();
    const networkId = deps.reader.network.id;
    if (networkId !== 'stellar-mainnet' && networkId !== 'stellar-testnet') throw new Error('contract-network');
    const record = deps.repository.getAccount(account.id);
    if (
      !record ||
      record.hidden ||
      account.hidden ||
      record.identityKind !== 'classic' ||
      account.identityKind !== 'classic' ||
      record.address !== account.address ||
      record.networkId !== networkId ||
      account.networkId !== networkId ||
      deps.reader.network.networkPassphrase !== NETWORKS[networkId].networkPassphrase ||
      !deps.reader.isClassicAddress(account.address)
    )
      throw new Error('contract-account-context');
    return networkId;
  };
  const assetKey = (networkId: string, address: string, contractId: string) =>
    JSON.stringify([address, walletAssetKey(networkId, { kind: 'contract', contractId })]);
  const validateId = (id: string) => {
    if (!/^C[A-Z2-7]{55}$/.test(id) || !deps.reader.isContractId(id)) throw new Error('contract-id-invalid');
  };
  const list = (account: AccountRecord) => {
    const networkId = current(account);
    return deps.store
      .list(networkId, account.address)
      .filter(
        record =>
          record.networkId === networkId &&
          record.accountAddress === account.address &&
          validContractTokenRecord(record) &&
          deps.reader.isContractId(record.contractId),
      );
  };
  async function load(
    account: AccountRecord,
    contractId: string,
    signal: AbortSignal,
    isCurrent: () => boolean,
    adding: boolean,
  ): Promise<ContractTokenRecord> {
    const networkId = current(account);
    validateId(contractId);
    const key = assetKey(networkId, account.address, contractId);
    const check = () => {
      if (signal.aborted || !isCurrent() || current(account) !== networkId) throw new Error('contract-account-context');
    };
    check();
    if (pending.has(key)) throw new Error('contract-asset-busy');
    const before = deps.store.get(networkId, account.address, contractId);
    if (adding && before) throw new Error('contract-already-tracked');
    if (!adding && !before) throw new Error('contract-not-tracked');
    if (adding && list(account).length >= MAX_TRACKED) throw new Error('contract-limit');
    const owner = {};
    pending.set(key, owner);
    try {
      const read = await deps.reader.readToken(contractId, account.address, signal);
      check();
      if (pending.get(key) !== owner || !validContractMetadata(read.metadata))
        throw new Error('contract-account-context');
      if (adding && (deps.store.get(networkId, account.address, contractId) || list(account).length >= MAX_TRACKED))
        throw new Error('contract-already-tracked');
      if (!adding && !deps.store.get(networkId, account.address, contractId)) throw new Error('contract-not-tracked');
      const now = deps.now();
      if (!validTime(now) || (before && now < before.attemptedAt)) throw new Error('contract-clock-invalid');
      if (read.balance && (!validContractBaseUnits(read.balance.baseUnits) || !validLedger(read.balance.ledger)))
        throw new Error('contract-balance-invalid');
      const acceptedBalance =
        read.balance && (!before?.balance || read.balance.ledger >= before.balance.ledger) ? read.balance : undefined;
      const balance = acceptedBalance
        ? { ...acceptedBalance, observedAt: now }
        : before?.metadata.decimals === read.metadata.decimals
          ? before.balance
          : undefined;
      const record: ContractTokenRecord = {
        networkId,
        accountAddress: account.address,
        contractId,
        metadata: { ...read.metadata },
        trackedAt: before?.trackedAt ?? now,
        attemptedAt: now,
        ...(balance ? { balance } : {}),
        balanceUnavailable: !acceptedBalance,
      };
      if (!validContractTokenRecord(record)) throw new Error('contract-record-invalid');
      deps.store.replace(record);
      return record;
    } finally {
      if (pending.get(key) === owner) pending.delete(key);
    }
  }
  return {
    network: deps.reader.network,
    isContractId: deps.reader.isContractId,
    list,
    classicMirrors(account: AccountRecord, assets: readonly BalanceAsset[]) {
      current(account);
      return assets.flatMap(asset => {
        try {
          const contractId = deps.reader.classicContractId?.(asset);
          return contractId && deps.reader.isContractId(contractId) ? [{ asset, contractId }] : [];
        } catch {
          return [];
        }
      });
    },
    track: (account: AccountRecord, id: string, signal: AbortSignal, isCurrent: () => boolean) =>
      load(account, id, signal, isCurrent, true),
    refresh: (account: AccountRecord, id: string, signal: AbortSignal, isCurrent: () => boolean) =>
      load(account, id, signal, isCurrent, false),
    markBalanceStale(account: AccountRecord, id: string) {
      const networkId = current(account);
      validateId(id);
      pending.delete(assetKey(networkId, account.address, id));
      const existing = deps.store.get(networkId, account.address, id);
      if (existing) deps.store.replace({ ...existing, balanceUnavailable: true });
    },
    remove(account: AccountRecord, id: string) {
      const networkId = current(account);
      validateId(id);
      pending.delete(assetKey(networkId, account.address, id));
      deps.store.remove(networkId, account.address, id);
    },
  };
}
