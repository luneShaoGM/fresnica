import { createContractTransfers, parseContractTransferAmount, type BuiltContractTransfer } from '../contractTransfer';
import type { AccountRecord } from '../../account/types';
import type { SignerRecord } from '../../signer/types';
import type { FresnicaSdkPort } from '../../ports/FresnicaSdkPort';
import type { ContractTokenRecord } from '../contractAssets';
import { NETWORKS } from '../../network/networkPreferences';
import type { PendingSubmissionRepository } from '../../transaction/pendingSubmission';

const network = NETWORKS['stellar-testnet'];
const source = 'G' + 'A'.repeat(55),
  destination = 'G' + 'B'.repeat(55),
  contractId = 'C' + 'A'.repeat(55);
const account: AccountRecord = {
  id: 'a',
  address: source,
  networkId: network.id,
  identityKind: 'classic',
  label: 'A',
  hidden: false,
  sortOrder: 0,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};
const signer: SignerRecord = {
  id: 's',
  publicKey: source,
  kind: 'protected-software',
  envelopeJson: 'synthetic-protected',
  envelopeRevision: 'r1',
  backupState: 'confirmed',
  createdAt: new Date(0),
  updatedAt: new Date(0),
};
const now = 1_800_000_000_000;
const record: ContractTokenRecord = {
  networkId: network.id,
  accountAddress: source,
  contractId,
  metadata: { name: 'Token', symbol: 'TOK', decimals: 7 },
  trackedAt: 1,
  attemptedAt: 1,
  balanceUnavailable: false,
  balance: { baseUnits: '20000000', ledger: 100, observedAt: 1 },
};
const built: BuiltContractTransfer = {
  networkId: network.id,
  source,
  transactionXdrBase64: 'unsigned',
  hash: 'a'.repeat(64),
  fee: '1100',
  resourceFee: '1000',
  expiresAtUnixSeconds: now / 1000 + 120,
};
const request = { contractId, destination, amount: '1.25' };
const signal = () => new AbortController().signal;

function fixture() {
  const repository = {
    getAccount: jest.fn(() => account as AccountRecord | undefined),
    listSignersForAccount: jest.fn(() => [signer]),
  };
  const assets = { list: jest.fn(() => [record]), markBalanceStale: jest.fn() };
  const reader = {
    network,
    isContractId: (x: string) => x === contractId,
    isClassicAddress: (x: string) => x === source || x === destination,
    readToken: jest.fn(async () => ({ metadata: record.metadata, balance: { baseUnits: '20000000', ledger: 101 } })),
  };
  const gateway = {
    network,
    prepare: jest.fn(async () => built),
    loadAccountAuthorization: jest.fn(async () => ({
      address: source,
      thresholds: { low: 1, medium: 1, high: 1 },
      signers: [{ kind: 'ed25519' as const, publicKey: source, weight: 1 }],
    })),
    verifySigned: jest.fn(),
    transactionHash: jest.fn(() => built.hash),
    loadTransactionOutcome: jest.fn(),
    submitTransaction: jest.fn(async () => ({ status: 'accepted' as const, hash: built.hash, ledger: 102 })),
  };
  const sdk = { signWithPassphrase: jest.fn(async () => 'signed') } as unknown as FresnicaSdkPort;
  const pending = {
    create: jest.fn(),
    get: jest.fn(),
    findBlockingIntent: jest.fn(),
    listUnresolved: jest.fn(() => []),
    markUncertain: jest.fn(),
    markConfirmed: jest.fn(),
    markRejected: jest.fn(),
    markStillUnknown: jest.fn(),
  } satisfies PendingSubmissionRepository;
  const recovery = { repository: pending, readInvalidation: { invalidate: jest.fn() }, now: () => new Date(now) };
  const authorizationEpoch = jest.fn<number | undefined, []>(() => 1);
  const monotonic = jest.fn(() => 1000);
  const product = createContractTransfers({
    repository,
    assets,
    reader,
    gateway,
    sdk,
    recovery,
    now: () => now,
    monotonic,
    authorizationEpoch,
  });
  return { repository, assets, reader, gateway, sdk, pending, product, authorizationEpoch, monotonic };
}
it('parses exact i128 decimal amounts without rounding', () => {
  expect(parseContractTransferAmount('1.0000001', 7)).toBe('10000001');
  expect(parseContractTransferAmount('0.000000000000000001', 18)).toBe('1');
  for (const input of ['0', '-1', '1e3', '1.00000001', '170141183460469231731687303715884105728'])
    expect(() => parseContractTransferAmount(input, 7)).toThrow();
});
it('requires tracked token identity, fresh balance and current account', async () => {
  const f = fixture();
  const review = await f.product.prepare(account, request, signal(), () => true);
  expect(review).toMatchObject({ contractId, destination, source, baseUnits: '12500000', amount: '1.25', decimals: 7 });
  expect(f.gateway.prepare).toHaveBeenCalledWith({ contractId, destination, source, baseUnits: '12500000' });
  await expect(f.product.prepare(account, { ...request, amount: '3' }, signal(), () => true)).rejects.toThrow(
    'contract-transfer-balance',
  );
  f.assets.list.mockReturnValue([]);
  await expect(f.product.prepare(account, request, signal(), () => true)).rejects.toThrow(
    'contract-transfer-not-tracked',
  );
});
it('rejects cloned review, changed authorization epoch, removed token and downgraded account', async () => {
  const f = fixture();
  const review = await f.product.prepare(account, request, signal(), () => true);
  await expect(f.product.submit({ ...review }, 'pass', () => true)).rejects.toThrow('contract-transfer-review');
  f.authorizationEpoch.mockReturnValue(2);
  await expect(f.product.submit(review, 'pass', () => true)).rejects.toThrow('contract-transfer-retired');
  f.authorizationEpoch.mockReturnValue(1);
  f.assets.list.mockReturnValue([]);
  await expect(f.product.submit(review, 'pass', () => true)).rejects.toThrow('contract-transfer-retired');
  f.repository.listSignersForAccount.mockReturnValue([]);
  await expect(f.product.submit(review, 'pass', () => true)).rejects.toThrow('contract-transfer-signer');
  expect(f.gateway.submitTransaction).not.toHaveBeenCalled();
});
it('submits only the exact reviewed signed hash through shared durable pending', async () => {
  const f = fixture();
  const review = await f.product.prepare(account, request, signal(), () => true);
  const result = await f.product.submit(review, 'test-passphrase', () => true);
  expect(f.gateway.verifySigned).toHaveBeenCalledWith(review, 'signed', source);
  expect(f.pending.create).toHaveBeenCalledWith(
    expect.objectContaining({ transactionHash: built.hash, intentKind: 'soroban-transfer', state: 'submitting' }),
  );
  expect(f.gateway.submitTransaction).toHaveBeenCalledWith('signed');
  expect(f.assets.markBalanceStale).toHaveBeenCalledWith(account, contractId);
  expect(f.pending.create.mock.invocationCallOrder[0]).toBeLessThan(
    f.assets.markBalanceStale.mock.invocationCallOrder[0],
  );
  expect(result).toMatchObject({ status: 'submitted', hash: built.hash });
});

it('retires review on monotonic expiry even if wall time has not advanced', async () => {
  const f = fixture();
  const review = await f.product.prepare(account, request, signal(), () => true);
  f.monotonic.mockReturnValue(121000);
  await expect(f.product.submit(review, 'pass', () => true)).rejects.toThrow('contract-transfer-retired');
  expect(f.gateway.loadAccountAuthorization).not.toHaveBeenCalled();
});
it('discards a late native signature after signer downgrade or application retirement', async () => {
  const f = fixture();
  const review = await f.product.prepare(account, request, signal(), () => true);
  (f.sdk.signWithPassphrase as jest.Mock).mockImplementationOnce(async () => {
    f.repository.listSignersForAccount.mockReturnValue([]);
    f.authorizationEpoch.mockReturnValue(2);
    return 'signed';
  });
  await expect(f.product.submit(review, 'pass', () => true)).rejects.toThrow();
  expect(f.pending.create).not.toHaveBeenCalled();
  expect(f.gateway.submitTransaction).not.toHaveBeenCalled();
});
