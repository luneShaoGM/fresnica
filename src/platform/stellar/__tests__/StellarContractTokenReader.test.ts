import { Asset, Keypair, Networks, nativeToScVal, SorobanDataBuilder, type rpc, type xdr } from '@stellar/stellar-sdk';
import { NETWORKS } from '@capabilities/network/networkPreferences';
import { createStellarContractTokenReader } from '../StellarContractTokenReader';

const network = NETWORKS['stellar-testnet'];
const account = Keypair.random().publicKey(); // Test fixture; no wallet data or signing.
const contractId = Asset.native().contractId(Networks.TESTNET);
const success = (retval: xdr.ScVal): rpc.Api.SimulateTransactionSuccessResponse => ({
  id: '1',
  latestLedger: 100,
  events: [],
  _parsed: true,
  transactionData: new SorobanDataBuilder(),
  minResourceFee: '0',
  result: { auth: [], retval },
});
function fixture() {
  const getNetwork = jest.fn().mockResolvedValue({ passphrase: network.networkPassphrase, protocolVersion: 30 });
  const simulateTransaction = jest
    .fn()
    .mockResolvedValueOnce(success(nativeToScVal('Token', { type: 'string' })))
    .mockResolvedValueOnce(success(nativeToScVal('TOK', { type: 'string' })))
    .mockResolvedValueOnce(success(nativeToScVal(7, { type: 'u32' })))
    .mockResolvedValueOnce(success(nativeToScVal(1234567890123456789n, { type: 'i128' })));
  const reader = createStellarContractTokenReader(network, { getNetwork, simulateTransaction });
  return { reader, getNetwork, simulateTransaction };
}
const signal = () => new AbortController().signal;

it('accepts only typed public simulations with a verified network, and never signs', async () => {
  const f = fixture();
  expect(f.reader.isContractId(contractId)).toBe(true);
  expect(f.reader.isClassicAddress(account)).toBe(true);
  expect(await f.reader.readToken(contractId, account, signal())).toEqual({
    metadata: { name: 'Token', symbol: 'TOK', decimals: 7 },
    balance: { baseUnits: '1234567890123456789', ledger: 100 },
  });
  expect(f.simulateTransaction).toHaveBeenCalledTimes(4);
  for (const [tx] of f.simulateTransaction.mock.calls) {
    expect(tx.source).toBe(account);
    expect(tx.signatures).toHaveLength(0);
    expect(tx.operations).toHaveLength(1);
    expect(tx.operations[0].type).toBe('invokeHostFunction');
  }
});

it('does not simulate on a wrong RPC network or invalid contract', async () => {
  const f = fixture();
  f.getNetwork.mockResolvedValueOnce({ passphrase: Networks.PUBLIC });
  await expect(f.reader.readToken(contractId, account, signal())).rejects.toThrow('contract-network');
  await expect(f.reader.readToken('Cbad', account, signal())).rejects.toThrow('contract-read-invalid');
  expect(f.simulateTransaction).not.toHaveBeenCalled();
});

it('derives network-bound SAC mirrors from exact Classic identity without a read', () => {
  const f = fixture();
  const issued = new Asset('USD', account);
  expect(f.reader.classicContractId?.({ kind: 'native', code: 'XLM' })).toBe(
    Asset.native().contractId(Networks.TESTNET),
  );
  expect(f.reader.classicContractId?.({ kind: 'credit', code: 'USD', issuer: account })).toBe(
    issued.contractId(Networks.TESTNET),
  );
  expect(
    createStellarContractTokenReader(NETWORKS['stellar-mainnet']).classicContractId?.({
      kind: 'credit',
      code: 'USD',
      issuer: account,
    }),
  ).not.toBe(issued.contractId(Networks.TESTNET));
  expect(() => f.reader.classicContractId?.({ kind: 'credit', code: 'USD', issuer: 'Gbad' })).toThrow(
    'contract-asset-invalid',
  );
  expect(f.simulateTransaction).not.toHaveBeenCalled();
});

it('rejects malformed metadata and does not conflate failed balance simulation with zero', async () => {
  const f = fixture();
  f.simulateTransaction.mockReset().mockResolvedValueOnce(success(nativeToScVal(1, { type: 'u32' })));
  await expect(f.reader.readToken(contractId, account, signal())).rejects.toThrow('contract-read-unavailable');
  const g = fixture();
  g.simulateTransaction
    .mockReset()
    .mockResolvedValueOnce(success(nativeToScVal('Token', { type: 'string' })))
    .mockResolvedValueOnce(success(nativeToScVal('TOK', { type: 'string' })))
    .mockResolvedValueOnce(success(nativeToScVal(7, { type: 'u32' })))
    .mockResolvedValueOnce({ error: 'missing', events: [], latestLedger: 100, id: '1', _parsed: true });
  expect(await g.reader.readToken(contractId, account, signal())).toEqual({
    metadata: { name: 'Token', symbol: 'TOK', decimals: 7 },
  });
});

it('rejects authorization, restoration or state-changing metadata responses', async () => {
  for (const patch of [
    { result: { auth: [{}], retval: nativeToScVal('TOK', { type: 'string' }) } },
    { restorePreamble: { transactionData: new SorobanDataBuilder(), minResourceFee: '1' } },
    { stateChanges: [{}] },
  ]) {
    const f = fixture();
    f.simulateTransaction
      .mockReset()
      .mockResolvedValueOnce({ ...success(nativeToScVal('TOK', { type: 'string' })), ...patch });
    await expect(f.reader.readToken(contractId, account, signal())).rejects.toThrow('contract-read-unavailable');
  }
});
