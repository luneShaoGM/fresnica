import type { AccountRecord } from '../../account/types';
import type { ClaimableRecord } from '../records';
import {
  prepareClaimableReview,
  submitClaimableReview,
  type ClaimableTransactionDependencies,
} from '../claimableTransaction';
import { submitReviewedTransaction } from '../../transaction/submitReviewedTransaction';

jest.mock('../../transaction/submitReviewedTransaction', () => ({
  submitReviewedTransaction: jest.fn(async () => ({
    status: 'submitted',
    hash: 'a'.repeat(64),
    authorization: 'system-auth',
  })),
}));

const address = 'G' + 'A'.repeat(55);
const issuer = 'G' + 'B'.repeat(55);
const balanceId = '00000000' + 'c'.repeat(64);
const account: AccountRecord = {
  id: 'a1',
  address,
  networkId: 'stellar-testnet',
  identityKind: 'classic',
  hidden: false,
  label: 'A',
  sortOrder: 0,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};
const record: ClaimableRecord = {
  id: balanceId,
  amount: '3.0000000',
  asset: { kind: 'native', code: 'XLM' },
  sponsor: issuer,
  claimant: address,
  predicate: { unconditional: true },
  risk: 'SAFE',
  riskFlags: [],
};
const expires = Math.floor(Date.now() / 1000) + 120;
const projected = { source: address, id: balanceId, fee: '100', expiresAtUnixSeconds: expires };
function fixtures(): {
  deps: ClaimableTransactionDependencies;
  current: jest.Mock;
  inspect: jest.Mock;
  signers: jest.Mock;
} {
  const current = jest.fn(async () => record);
  const inspect = jest.fn(() => projected);
  const signers = jest.fn(() => [{ publicKey: address }]);
  const gateway = {
    loadAccountState: jest.fn(async () => ({
      status: 'active',
      account: { address, balances: [{ kind: 'native', balance: '10' }] },
    })),
    loadLedgerParameters: jest.fn(async () => ({ baseFeeStroops: 100, baseReserveStroops: 5000000 })),
    buildClaimClaimableBalance: jest.fn(async () => ({
      source: address,
      networkId: 'stellar-testnet',
      transactionXdrBase64: 'BASE64-REVIEW',
    })),
    inspectClaimClaimableBalance: inspect,
  };
  const deps = {
    network: { id: 'stellar-testnet', networkPassphrase: 'Test SDF Network ; September 2015' },
    reader: { current },
    gateway,
    repository: { listSignersForAccount: signers },
    sdk: {},
    recovery: {},
  } as unknown as ClaimableTransactionDependencies;
  return { deps, current, inspect, signers };
}
beforeEach(() => jest.clearAllMocks());

describe('S11 exact-XDR claim preflight and approval boundary', () => {
  it('prepares only an account- and network-bound exact claim operation', async () => {
    const { deps, inspect } = fixtures();
    const review = await prepareClaimableReview(deps, account, record);
    expect(review).toMatchObject({ transactionXdrBase64: 'BASE64-REVIEW', id: balanceId, source: address, fee: '100' });
    expect(inspect).toHaveBeenCalledWith('BASE64-REVIEW', deps.network.networkPassphrase);
  });

  it('rejects a mismatched claimant, stale amount and XDR operation id before presenting review', async () => {
    const { deps, current, inspect } = fixtures();
    await expect(prepareClaimableReview(deps, account, { ...record, claimant: issuer })).rejects.toThrow(
      'claimable-record-stale-or-claimed',
    );
    current.mockResolvedValue({ ...record, amount: '5.0000000' });
    await expect(prepareClaimableReview(deps, account, record)).rejects.toThrow('claimable-record-stale-or-claimed');
    current.mockResolvedValue(record);
    inspect.mockReturnValue({ ...projected, id: '00000000' + 'd'.repeat(64) });
    await expect(prepareClaimableReview(deps, account, record)).rejects.toThrow('claimable-build-xdr-mismatch');
  });

  it('rejects unknown predicates and wrong network before any signer operation', async () => {
    const { deps, signers, current } = fixtures();
    current.mockResolvedValue({ ...record, predicate: { rel_before: '100' } });
    await expect(
      prepareClaimableReview(deps, account, { ...record, predicate: { rel_before: '100' } }),
    ).rejects.toThrow('claimable-predicate-unavailable');
    await expect(prepareClaimableReview(deps, { ...account, networkId: 'stellar-mainnet' }, record)).rejects.toThrow(
      'claimable-network-account-mismatch',
    );
    expect(signers).not.toHaveBeenCalled();
  });

  it('re-reads the live balance before signing and rejects a changed record', async () => {
    const { deps, current } = fixtures();
    const review = await prepareClaimableReview(deps, account, record);
    current.mockResolvedValue({ ...record, amount: '11.0000000' });
    await expect(submitClaimableReview(deps, account, review, 'Claim')).rejects.toThrow(
      'claimable-record-stale-or-claimed',
    );
    expect(submitReviewedTransaction).not.toHaveBeenCalled();
  });

  it('does not bypass watch-only or multiple signer restrictions', async () => {
    const { deps, signers } = fixtures();
    const review = await prepareClaimableReview(deps, account, record);
    signers.mockReturnValue([]);
    expect(await submitClaimableReview(deps, account, review, 'Claim')).toEqual({ status: 'watch-only' });
    signers.mockReturnValue([{ publicKey: address }, { publicKey: issuer }]);
    expect(await submitClaimableReview(deps, account, review, 'Claim')).toEqual({
      status: 'unsupported-account-signers',
    });
    expect(submitReviewedTransaction).not.toHaveBeenCalled();
  });

  it('hands off exactly the reviewed XDR and claim intent to the existing signing/recovery path', async () => {
    const { deps } = fixtures();
    const review = await prepareClaimableReview(deps, account, record);
    await expect(submitClaimableReview(deps, account, review, 'Claim')).resolves.toMatchObject({ status: 'submitted' });
    expect(submitReviewedTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        review,
        accountId: 'a1',
        networkPassphrase: deps.network.networkPassphrase,
        intent: expect.objectContaining({ kind: 'claimable' }),
      }),
    );
  });
});
