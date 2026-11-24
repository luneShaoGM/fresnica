import {
  createContractAssets,
  formatContractBalance,
  type ContractAssetStore,
  type ContractTokenRead,
  type ContractTokenRecord,
} from '../contractAssets';
import { walletAssetKey } from '../walletAssetIdentity';
import type { AccountRecord } from '../../account/types';
import { NETWORKS } from '../../network/networkPreferences';

const network = NETWORKS['stellar-testnet'];
const address = 'G' + 'A'.repeat(55);
const contractId = 'C' + 'A'.repeat(55);
const second = 'C' + 'B'.repeat(55);
const account: AccountRecord = {
  id: 'a',
  address,
  networkId: network.id,
  identityKind: 'classic',
  label: 'Wallet',
  sortOrder: 0,
  hidden: false,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};
const metadata = { name: 'Token', symbol: 'TOK', decimals: 7 };
const read: ContractTokenRead = { metadata, balance: { baseUnits: '1234567890123456789012345678', ledger: 100 } };
const signal = () => new AbortController().signal;
const live = () => true;

function fixture() {
  const records = new Map<string, ContractTokenRecord>();
  const key = (net: string, addr: string, id: string) => JSON.stringify([net, addr, id]);
  const store: ContractAssetStore = {
    list: (net, addr) => [...records.values()].filter(r => r.networkId === net && r.accountAddress === addr),
    get: (net, addr, id) => records.get(key(net, addr, id)),
    replace: r => {
      records.set(key(r.networkId, r.accountAddress, r.contractId), r);
    },
    remove: (net, addr, id) => {
      records.delete(key(net, addr, id));
    },
    clearPartition: (net, addr) => {
      for (const [k, r] of records) if (r.networkId === net && r.accountAddress === addr) records.delete(k);
    },
  };
  const readToken = jest.fn<Promise<ContractTokenRead>, [string, string, AbortSignal]>().mockResolvedValue(read);
  const getAccount = jest
    .fn<AccountRecord | undefined, [string]>()
    .mockImplementation(id => (id === account.id ? account : undefined));
  const now = jest.fn(() => 1000);
  const assertOpen = jest.fn();
  const product = createContractAssets({
    store,
    repository: { getAccount },
    reader: {
      network,
      readToken,
      isContractId: value => value.startsWith('C'),
      isClassicAddress: value => value.startsWith('G'),
      classicContractId: asset => asset.kind === 'native' ? second : asset.issuer === address ? contractId : second,
    },
    now,
    assertOpen,
  });
  return { product, store, readToken, getAccount, now, assertOpen };
}

it('distinguishes network, issuer, native and contract identities', () => {
  const identities = [
    walletAssetKey('stellar-testnet', { kind: 'native', code: 'XLM' }),
    walletAssetKey('stellar-mainnet', { kind: 'native', code: 'XLM' }),
    walletAssetKey('stellar-testnet', { kind: 'credit', code: 'TOK', issuer: address }),
    walletAssetKey('stellar-testnet', { kind: 'contract', contractId }),
    walletAssetKey('stellar-testnet', { kind: 'contract', contractId: second }),
  ];
  expect(new Set(identities).size).toBe(identities.length);
});

it('projects exact Classic SAC relationships without adding a second tracked holding', async () => {
  const f = fixture();
  const otherIssuer = 'G' + 'B'.repeat(55);
  const mirrors = f.product.classicMirrors(account, [
    { kind: 'credit', code: 'TOK', issuer: address },
    { kind: 'credit', code: 'TOK', issuer: otherIssuer },
  ]);
  expect(mirrors.map(row => row.contractId)).toEqual([contractId, second]);
  expect(f.product.list(account)).toHaveLength(0);
  await f.product.track(account, contractId, signal(), live);
  expect(f.product.list(account)).toHaveLength(1);
  expect(f.readToken).toHaveBeenCalledTimes(1);
});

it('tracks the precise contract and keeps arbitrary-size balances as exact integers', async () => {
  const f = fixture();
  const record = await f.product.track(account, contractId, signal(), live);
  expect(f.readToken).toHaveBeenCalledWith(contractId, address, expect.anything());
  expect(record.balance?.baseUnits).toBe(read.balance?.baseUnits);
  expect(formatContractBalance(record.balance!.baseUnits, 7)).toBe('123456789012345678901.2345678');
  await f.product.track(account, second, signal(), live);
  expect(f.product.list(account).map(r => r.contractId)).toEqual([contractId, second]);
  await expect(f.product.track(account, contractId, signal(), live)).rejects.toThrow('contract-already-tracked');
  expect(f.readToken).toHaveBeenCalledTimes(2);
});

it('keeps unknown distinct from a real zero and preserves prior observations on failure', async () => {
  const f = fixture();
  f.readToken.mockResolvedValueOnce({ metadata });
  const unknown = await f.product.track(account, contractId, signal(), live);
  expect(unknown.balance).toBeUndefined();
  expect(unknown.balanceUnavailable).toBe(true);
  f.now.mockReturnValue(2000);
  f.readToken.mockResolvedValueOnce({ metadata, balance: { baseUnits: '0', ledger: 101 } });
  const zero = await f.product.refresh(account, contractId, signal(), live);
  expect(zero.balance).toEqual({ baseUnits: '0', ledger: 101, observedAt: 2000 });
  expect(zero.balanceUnavailable).toBe(false);
  f.now.mockReturnValue(3000);
  f.readToken.mockResolvedValueOnce({ metadata });
  const failed = await f.product.refresh(account, contractId, signal(), live);
  expect(failed.balance).toEqual(zero.balance);
  expect(failed.balanceUnavailable).toBe(true);
  f.now.mockReturnValue(4000);
  f.readToken.mockResolvedValueOnce({ metadata: { ...metadata, decimals: 8 } });
  expect((await f.product.refresh(account, contractId, signal(), live)).balance).toBeUndefined();
});

it('rejects mismatched network, hidden account, invalid metadata and malformed IDs', async () => {
  const f = fixture();
  await expect(
    f.product.track({ ...account, networkId: 'stellar-mainnet' }, contractId, signal(), live),
  ).rejects.toThrow();
  await expect(f.product.track({ ...account, hidden: true }, contractId, signal(), live)).rejects.toThrow();
  await expect(f.product.track(account, 'Cbad', signal(), live)).rejects.toThrow();
  expect(f.readToken).not.toHaveBeenCalled();
  f.readToken.mockResolvedValueOnce({ metadata: { ...metadata, symbol: '\u202eFAKE' } });
  await expect(f.product.track(account, contractId, signal(), live)).rejects.toThrow();
  expect(f.product.list(account)).toHaveLength(0);
});

it('does not recreate a removed contract, even if the older refresh resolves after re-add', async () => {
  const f = fixture();
  await f.product.track(account, contractId, signal(), live);
  let resolve!: (value: ContractTokenRead) => void;
  f.readToken.mockImplementationOnce(
    () =>
      new Promise(r => {
        resolve = r;
      }),
  );
  const older = f.product.refresh(account, contractId, signal(), live);
  f.product.remove(account, contractId);
  f.now.mockReturnValue(2000);
  f.readToken.mockResolvedValueOnce({ metadata, balance: { baseUnits: '1', ledger: 102 } });
  await f.product.track(account, contractId, signal(), live);
  resolve(read);
  await expect(older).rejects.toThrow();
  expect(f.product.list(account)[0].balance?.baseUnits).toBe('1');
});

it('does not persist a result after account deletion, cancellation or focus retirement', async () => {
  const f = fixture();
  let resolve!: (value: ContractTokenRead) => void;
  f.readToken.mockImplementationOnce(
    () =>
      new Promise(r => {
        resolve = r;
      }),
  );
  const old = f.product.track(account, contractId, signal(), live);
  f.getAccount.mockReturnValue(undefined);
  resolve(read);
  await expect(old).rejects.toThrow();
  expect(f.store.list(network.id, address)).toHaveLength(0);
  f.getAccount.mockReturnValue(account);
  const controller = new AbortController();
  f.readToken.mockImplementationOnce(async () => {
    controller.abort();
    return read;
  });
  await expect(f.product.track(account, contractId, controller.signal, live)).rejects.toThrow();
  let focused = true;
  f.readToken.mockImplementationOnce(async () => {
    focused = false;
    return read;
  });
  await expect(f.product.track(account, contractId, signal(), () => focused)).rejects.toThrow();
  expect(f.store.list(network.id, address)).toHaveLength(0);
});

it.each(['-1', '01', '1e3', '170141183460469231731687303715884105728'])('rejects invalid i128 amount %s', value => {
  expect(formatContractBalance(value, 7)).toBeUndefined();
});

it('keeps the prior observation when the RPC returns an older ledger', async () => {
  const f = fixture();
  const original = await f.product.track(account, contractId, signal(), live);
  f.now.mockReturnValue(2000);
  f.readToken.mockResolvedValueOnce({ metadata, balance: { baseUnits: '1', ledger: 99 } });
  const refreshed = await f.product.refresh(account, contractId, signal(), live);
  expect(refreshed.balance).toEqual(original.balance);
  expect(refreshed.balanceUnavailable).toBe(true);
});

it('retires an older balance read after durable transfer invalidation without deleting membership', async () => {
  const f = fixture();
  const previous = await f.product.track(account, contractId, signal(), live);
  let resolve!: (value: ContractTokenRead) => void;
  f.readToken.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
  const old = f.product.refresh(account, contractId, signal(), live);
  f.product.markBalanceStale(account, contractId);
  resolve(read);
  await expect(old).rejects.toThrow();
  expect(f.product.list(account)[0]).toMatchObject({ balance: previous.balance, balanceUnavailable: true });
});
