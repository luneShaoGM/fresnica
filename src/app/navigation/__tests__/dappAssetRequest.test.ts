import { Account, Asset, Networks, Operation, StrKey, TransactionBuilder } from '@stellar/stellar-sdk';
import {
  prepareTrustlineProductReview,
  submitTrustlineProductReview,
  type TrustlineProductDependencies,
} from '../../../features/trustlines/trustlineProductFlow';
import { createDappAssetRequest } from '../createDappAssetRequest';

jest.mock('../../../features/trustlines/trustlineProductFlow', () => ({
  prepareTrustlineProductReview: jest.fn(),
  submitTrustlineProductReview: jest.fn(),
}));

const addr = (n: number) => StrKey.encodeEd25519PublicKey(new Uint8Array(32).fill(n));
const selection = {
  address: addr(1),
  accountId: 'one',
  networkId: 'stellar-testnet',
  networkPassphrase: Networks.TESTNET,
  networkUrl: '',
  revision: 1,
};
const account = {
  id: selection.accountId,
  address: selection.address,
  networkId: selection.networkId,
  identityKind: 'classic',
  hidden: false,
};
const request = { code: 'USD', issuer: addr(2) };
const prepare = jest.mocked(prepareTrustlineProductReview);
const submit = jest.mocked(submitTrustlineProductReview);

function dependencies() {
  return {
    repository: {
      getAccount: jest.fn().mockReturnValue(account),
      listSignersForAccount: jest.fn().mockReturnValue([{ publicKey: account.address, kind: 'protected-software' }]),
    },
    network: { id: account.networkId, networkPassphrase: Networks.TESTNET },
  } as unknown as TrustlineProductDependencies;
}

function transaction(issuer = request.issuer) {
  return new TransactionBuilder(new Account(account.address, '12'), { fee: '100', networkPassphrase: Networks.TESTNET })
    .addOperation(Operation.changeTrust({ asset: new Asset(request.code, issuer), limit: '4' }))
    .setTimeout(90)
    .build()
    .toXDR();
}

beforeEach(() => jest.resetAllMocks());

const transactionHash = 'a'.repeat(64);
it.each([
  [{ status: 'submitted', hash: transactionHash, authorization: 'passphrase' }, { status: 'added' }],
  [{ status: 'uncertain', transactionHash }, { status: 'submission-uncertain', transactionHash }],
] as const)('preserves the result of submitting the exact reviewed trustline (%j)', async (result, expected) => {
  const deps = dependencies();
  const review = {
    transactionXdrBase64: transaction(),
    networkId: account.networkId,
    source: account.address,
    fee: '100',
    operation: 'add' as const,
    asset: request,
    limit: '4.0000000',
  };
  prepare.mockResolvedValue(review);
  submit.mockResolvedValue(result);
  const staged = await createDappAssetRequest(deps)(selection, request);
  expect(staged?.intent.operations[0]).toMatchObject({
    type: 'change-trust',
    assetIssuer: request.issuer,
    limit: '4.0000000',
  });
  expect(submit).not.toHaveBeenCalled();
  expect(await staged?.submit('passphrase', () => false)).toEqual({ status: 'asset-failed' });
  expect(submit).not.toHaveBeenCalled();
  const current = () => true;
  await expect(staged?.submit('passphrase', current)).resolves.toEqual(expected);
  expect(submit).toHaveBeenCalledWith(deps, account, review, '', 'passphrase', current);
});

it('rejects forged contract IDs and a prepared transaction for a different issuer', async () => {
  const create = createDappAssetRequest(dependencies());
  const mismatch = new Asset(request.code, addr(3)).contractId(Networks.TESTNET);
  await expect(create(selection, { ...request, contractId: mismatch })).resolves.toBeUndefined();
  expect(prepare).not.toHaveBeenCalled();
  prepare.mockResolvedValue({
    transactionXdrBase64: transaction(addr(3)),
    networkId: account.networkId,
    source: account.address,
    fee: '100',
    operation: 'add',
    asset: request,
    limit: '4.0000000',
  });
  await expect(create(selection, request)).resolves.toBeUndefined();
  expect(submit).not.toHaveBeenCalled();
});
