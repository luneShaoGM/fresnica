import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Address, Asset, Networks, nativeToScVal, xdr } from '@stellar/stellar-sdk';

import { readReviewableDappTransaction } from '../readReviewableDappTransaction';

const captured = readFileSync(join(__dirname, 'fixtures/blend-testnet-v21-supply.xdr'), 'utf8').trim();
const source = 'GDPIXLPFTX6RXCFZIVNLSP6BVMOUC6XIFZQQH55UPEE7ZLB6ZXIEGLDK';
const pool = 'CB3447A446DY3USGWPIDXTNQHF5EX24XDQA2EN6TAZP62JTPBTNOA52Q';
const token = Asset.native().contractId(Networks.TESTNET);

function fixture() {
  const envelope = xdr.TransactionEnvelope.fromXDR(captured, 'base64');
  if (envelope.type !== 'envelopeTypeTx') throw new Error('Expected a V1 envelope');
  const operation = envelope.v1.tx.operations[0];
  if (operation.body.type !== 'invokeHostFunction') throw new Error('Expected a contract invocation');
  const invocation = operation.body.invokeHostFunctionOp;
  return { envelope, invocation };
}

describe('reviewed Soroban DApp transaction envelopes', () => {
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-27T08:00:00Z'));
  });

  afterEach(() => jest.restoreAllMocks());

  it('reviews the live Blend simulation fixture without changing its hash', () => {
    expect(readReviewableDappTransaction(captured, Networks.TESTNET, source)).toMatchObject({
      hash: '6f1efe986f00f2eece87d7dbf261be2dae19f4742b6553d22de2bb12b86f7bc0',
      source,
      fee: '826534',
      operations: [
        { type: 'soroban-supply-collateral', contract: pool, destination: pool, amount: '1.0000000', assetCode: 'XLM' },
      ],
    });
  });

  it('reviews a standard token transfer independently of any Blend pool or page', () => {
    const { envelope, invocation } = fixture();
    const args = [
      Address.fromString(source).toScVal(),
      Address.fromString(pool).toScVal(),
      nativeToScVal(2500000n, { type: 'i128' }),
    ];
    const call = new xdr.InvokeContractArgs({
      contractAddress: Address.fromString(token).toScAddress(),
      functionName: 'transfer',
      args,
    });
    Object.assign(invocation, { hostFunction: xdr.HostFunction.hostFunctionTypeInvokeContract(call) });
    Object.assign(invocation.auth[0], {
      rootInvocation: new xdr.SorobanAuthorizedInvocation({
        function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(call),
        subInvocations: [],
      }),
    });
    expect(readReviewableDappTransaction(envelope.toXdr('base64'), Networks.TESTNET, source)?.operations).toEqual([
      { type: 'soroban-transfer', contract: token, destination: pool, amount: '0.2500000', assetCode: 'XLM' },
    ]);
  });

  it('rejects extra authorization entries and a nested transfer of a different amount', () => {
    const { envelope, invocation } = fixture();
    const entry = invocation.auth[0];
    invocation.auth.push(entry);
    expect(readReviewableDappTransaction(envelope.toXdr('base64'), Networks.TESTNET, source)).toBeUndefined();
    invocation.auth.pop();
    const nested = entry.rootInvocation.subInvocations[0].function;
    if (nested.type !== 'sorobanAuthorizedFunctionTypeContractFn') throw new Error('Expected a token transfer');
    nested.contractFn.args[2] = nativeToScVal(10000001n, { type: 'i128' });
    expect(readReviewableDappTransaction(envelope.toXdr('base64'), Networks.TESTNET, source)).toBeUndefined();
  });

  it('rejects an address credential that requires signing outside the transaction envelope', () => {
    const { envelope, invocation } = fixture();
    Object.assign(invocation.auth[0], {
      credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(
        new xdr.SorobanAddressCredentials({
          address: Address.fromString(source).toScAddress(),
          nonce: 1n,
          signatureExpirationLedger: 5948600,
          signature: xdr.ScVal.scvVoid(),
        }),
      ),
    });
    expect(readReviewableDappTransaction(envelope.toXdr('base64'), Networks.TESTNET, source)).toBeUndefined();
  });

  it('rejects unsupported networks and expired envelopes before presenting a review', () => {
    expect(readReviewableDappTransaction(captured, Networks.PUBLIC, source)).toBeUndefined();
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-29T00:00:00Z'));
    expect(readReviewableDappTransaction(captured, Networks.TESTNET, source)).toBeUndefined();
  });
});
