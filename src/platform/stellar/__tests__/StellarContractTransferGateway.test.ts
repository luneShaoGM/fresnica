import {
  Account,
  Address,
  Asset,
  Keypair,
  Networks,
  Transaction,
  SorobanDataBuilder,
  nativeToScVal,
  xdr,
  rpc,
} from '@stellar/stellar-sdk';
import { NETWORKS } from '@capabilities/network/networkPreferences';
import { createStellarContractTransferGateway } from '../StellarContractTransferGateway';
import type { StellarAccountStateResult } from '@capabilities/stellar/types';

const network = NETWORKS['stellar-testnet'];
const signer = Keypair.random();
const destination = Keypair.random().publicKey();
const operation = {
  source: signer.publicKey(),
  destination,
  contractId: Asset.native().contractId(Networks.TESTNET),
  baseUnits: '10000000',
};
const now = 1_800_000_000_000;
const call = new xdr.InvokeContractArgs({
  contractAddress: Address.fromString(operation.contractId).toScAddress(),
  functionName: 'transfer',
  args: [
    Address.fromString(operation.source).toScVal(),
    Address.fromString(destination).toScVal(),
    nativeToScVal(BigInt(operation.baseUnits), { type: 'i128' }),
  ],
});
function auth() {
  return new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsSourceAccount(),
    rootInvocation: new xdr.SorobanAuthorizedInvocation({
      function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(call),
      subInvocations: [],
    }),
  });
}
function success(): rpc.Api.SimulateTransactionSuccessResponse {
  return {
    id: '1',
    latestLedger: 100,
    events: [],
    _parsed: true,
    transactionData: new SorobanDataBuilder().setResourceFee(1000),
    minResourceFee: '1000',
    result: { auth: [auth()], retval: xdr.ScVal.scvVoid() },
  };
}
function fixture() {
  const loadAccountState = jest.fn(async (address: string): Promise<StellarAccountStateResult> => ({
    status: 'active',
    account: {
      address,
      subentryCount: 0,
      numSponsored: 0,
      numSponsoring: 0,
      flags: { authRequired: false, authClawbackEnabled: false },
      balances: [{ kind: 'native', balance: '100.0000000', buyingLiabilities: '0', sellingLiabilities: '0' }],
    },
  }));
  const classic = {
    loadAccountState,
    loadLedgerParameters: jest.fn(async () => ({ baseFeeStroops: 100, baseReserveStroops: 5000000 })),
    loadAccountAuthorization: jest.fn(),
  };
  const server = {
    getNetwork: jest.fn().mockResolvedValue({ passphrase: network.networkPassphrase }),
    getAccount: jest.fn(async (address: string) => new Account(address, '12')),
    simulateTransaction: jest.fn().mockResolvedValue(success()),
    sendTransaction: jest.fn(),
    getTransaction: jest.fn(),
  };
  const gateway = createStellarContractTransferGateway(network, classic, () => now, server);
  return { gateway, server, classic };
}
async function signedFixture() {
  const f = fixture();
  const review = await f.gateway.prepare(operation);
  const tx = new Transaction(review.transactionXdrBase64, Networks.TESTNET);
  tx.sign(signer); // test-only ephemeral signature; production signing uses the Native SDK.
  const signed = tx.toXdr();
  return { ...f, review, tx, signed };
}
it('assembles a single exact reviewed source-account invocation with resource fee and finite expiry', async () => {
  const f = fixture();
  const review = await f.gateway.prepare(operation);
  expect(review).toMatchObject({
    source: operation.source,
    networkId: network.id,
    fee: '1100',
    resourceFee: '1000',
    expiresAtUnixSeconds: now / 1000 + 120,
  });
  const tx = new Transaction(review.transactionXdrBase64, Networks.TESTNET);
  expect(tx.signatures).toHaveLength(0);
  expect(tx.operations).toHaveLength(1);
  expect(tx.operations[0].type).toBe('invokeHostFunction');
  expect(f.server.sendTransaction).not.toHaveBeenCalled();
});
it.each([
  { result: { auth: [], retval: xdr.ScVal.scvVoid() } },
  {
    result: { auth: [{ ...auth(), credentials: { type: 'sorobanCredentialsAddress' } }], retval: xdr.ScVal.scvVoid() },
  },
  { result: { auth: [auth(), auth()], retval: xdr.ScVal.scvVoid() } },
  { result: { auth: [auth()], retval: nativeToScVal(1, { type: 'u32' }) } },
  { restorePreamble: { transactionData: new SorobanDataBuilder(), minResourceFee: '100' } },
  { minResourceFee: '10000001' },
])('rejects unsupported simulation %p', async patch => {
  const f = fixture();
  f.server.simulateTransaction.mockResolvedValueOnce({ ...success(), ...patch });
  await expect(f.gateway.prepare(operation)).rejects.toThrow();
  expect(f.server.sendTransaction).not.toHaveBeenCalled();
});
it('rejects wrong network, memo-required destination, and native reserve shortfall', async () => {
  const f = fixture();
  f.server.getNetwork.mockResolvedValueOnce({ passphrase: Networks.PUBLIC });
  await expect(f.gateway.prepare(operation)).rejects.toThrow('contract-transfer-network');
  expect(f.server.getAccount).not.toHaveBeenCalled();
  const g = fixture();
  const recipient = await g.classic.loadAccountState(destination);
  if (recipient.status !== 'active') throw new Error('fixture');
  g.classic.loadAccountState
    .mockImplementationOnce(async address => ({ ...recipient, account: { ...recipient.account, address } }))
    .mockResolvedValueOnce({ ...recipient, account: { ...recipient.account, memoRequired: true } });
  await expect(g.gateway.prepare(operation)).rejects.toThrow('contract-transfer-account');
  const h = fixture();
  const sourceState = await h.classic.loadAccountState(operation.source);
  if (sourceState.status !== 'active') throw new Error('fixture');
  h.classic.loadAccountState.mockResolvedValueOnce({
    ...sourceState,
    account: {
      ...sourceState.account,
      balances: [{ kind: 'native', balance: '1.1', buyingLiabilities: '0', sellingLiabilities: '0' }],
    },
  });
  await expect(h.gateway.prepare(operation)).rejects.toThrow('contract-transfer-balance');
});
it('checks native-signed envelope hash and exact public signature before admission', async () => {
  const f = await signedFixture();
  expect(() => f.gateway.verifySigned(f.review, f.signed, signer.publicKey())).not.toThrow();
  expect(() => f.gateway.verifySigned(f.review, f.signed, Keypair.random().publicKey())).toThrow();
  expect(() => f.gateway.verifySigned(f.review, f.review.transactionXdrBase64, signer.publicKey())).toThrow();
  expect(() => f.gateway.verifySigned({ ...f.review, hash: '0'.repeat(64) }, f.signed, signer.publicKey())).toThrow();
});
it('treats admission as uncertain until exact-hash ledger confirmation', async () => {
  const f = await signedFixture();
  f.server.sendTransaction.mockResolvedValue({ status: 'PENDING', hash: f.review.hash });
  f.server.getTransaction.mockResolvedValue({ status: rpc.Api.GetTransactionStatus.NOT_FOUND, txHash: f.review.hash });
  await expect(f.gateway.submitTransaction(f.signed)).resolves.toEqual({
    status: 'uncertain',
    transactionHash: f.review.hash,
  });
  expect(f.server.sendTransaction).toHaveBeenCalledTimes(1);
  f.server.getTransaction.mockResolvedValue({
    status: rpc.Api.GetTransactionStatus.SUCCESS,
    txHash: f.review.hash,
    feeBump: false,
    ledger: 101,
    envelopeXdr: f.tx.toEnvelope(),
  });
  await expect(f.gateway.loadTransactionOutcome(f.review.hash)).resolves.toEqual({
    status: 'confirmed',
    transactionHash: f.review.hash,
    ledger: 101,
  });
  expect(f.server.sendTransaction).toHaveBeenCalledTimes(1);
  f.server.getTransaction.mockResolvedValue({
    status: rpc.Api.GetTransactionStatus.SUCCESS,
    txHash: '0'.repeat(64),
    feeBump: false,
    ledger: 101,
    envelopeXdr: f.tx.toEnvelope(),
  });
  await expect(f.gateway.loadTransactionOutcome(f.review.hash)).rejects.toThrow('contract-transfer-hash');
});
