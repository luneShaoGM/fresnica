import { createHorizonPublicReadGateway } from '../HorizonPublicReadGateway';
import { retryAfterMilliseconds } from '../horizonReadHttp';
import { StellarSdkGateway } from '../StellarSdkGateway';
import type { HorizonServerLike } from '../types';

const endpoint = 'https://node.test';
const signal = new AbortController().signal;
const rawOperation = {
  id: 'op',
  paging_token: '9007199254740993',
  type: 'payment',
  created_at: '2026-10-26T01:00:00Z',
  transaction_hash: 'hash',
  source_account: 'Ga',
  from: 'Ga',
  to: 'Gb',
  amount: '1.0000000',
  asset_type: 'native',
};
const rawAccount = {
  account_id: 'Ga',
  last_modified_ledger: 50,
  balances: [
    { asset_type: 'native', balance: '9007199254740993.0000001' },
    {
      asset_type: 'credit_alphanum4',
      asset_code: 'MixD',
      asset_issuer: 'Gissuer',
      balance: '3.0000000',
      limit: '10.0000000',
    },
  ],
};
const response = (body: unknown) => ({ ok: true, status: 200, json: async () => body, headers: { get: () => null } });
it('preserves the established SDK public read projections and opaque paging across the abortable HTTP adapter', async () => {
  const http = jest
    .fn()
    .mockResolvedValueOnce(response(rawAccount))
    .mockResolvedValueOnce(response({ _embedded: { records: [rawOperation] } }))
    .mockResolvedValueOnce(response(rawOperation));
  const publicReads = createHorizonPublicReadGateway(http);
  const old = new StellarSdkGateway({ network: { id: 'testnet', networkPassphrase: 'test' }, horizonUrl: endpoint }, {
    loadAccount: async () => rawAccount,
    loadAccountOperations: async () => ({ records: [rawOperation] }),
    loadOperation: async () => rawOperation,
  } as unknown as HorizonServerLike);
  expect(await publicReads.loadAccountBalances(endpoint, 'Ga', signal)).toEqual({
    ...(await old.loadAccountBalances('Ga')),
    lastModifiedLedger: 50,
  });
  const input = { address: 'Ga', limit: 1, cursor: 'opaque+cursor' };
  expect(await publicReads.loadAccountOperations(endpoint, input, signal)).toEqual(
    await old.loadAccountOperations(input),
  );
  expect(await publicReads.loadOperation(endpoint, { accountAddress: 'Ga', operationId: 'op' }, signal)).toEqual(
    await old.loadOperation({ accountAddress: 'Ga', operationId: 'op' }),
  );
  expect(http.mock.calls[1]).toEqual([
    'https://node.test/accounts/Ga/operations?order=desc&limit=1&cursor=opaque%2Bcursor',
    { signal },
  ]);
});
it('keeps account, operation and transaction 404 semantics distinct from node failure', async () => {
  const http = jest.fn().mockResolvedValue({ status: 404 });
  const reads = createHorizonPublicReadGateway(http);
  await expect(reads.loadAccountBalances(endpoint, 'Ga', signal)).resolves.toEqual({
    status: 'inactive',
    address: 'Ga',
  });
  await expect(reads.loadAccountOperations(endpoint, { address: 'Ga', limit: 5 }, signal)).resolves.toEqual({
    status: 'inactive',
    address: 'Ga',
  });
  await expect(reads.loadOperation(endpoint, { accountAddress: 'Ga', operationId: 'op' }, signal)).resolves.toEqual({
    status: 'not-found',
  });
  await expect(reads.loadTransactionOutcome(endpoint, 'hash', signal)).resolves.toEqual({
    status: 'still-unknown',
    transactionHash: 'hash',
  });
  await expect(reads.probe(endpoint, signal)).rejects.toMatchObject({ kind: 'protocol' });
});
it('validates root identity and hash-bound transaction outcomes without exposing broadcast methods', async () => {
  const http = jest
    .fn()
    .mockResolvedValueOnce(response({ network_passphrase: 'testnet' }))
    .mockResolvedValueOnce(response({ hash: 'hash', successful: true, ledger: 50 }))
    .mockResolvedValueOnce(response({ hash: 'hash', successful: false, ledger: 50 }))
    .mockResolvedValueOnce(response({ hash: 'other', successful: true, ledger: 50 }));
  const reads = createHorizonPublicReadGateway(http);
  await expect(reads.probe(endpoint, signal)).resolves.toBe('testnet');
  await expect(reads.loadTransactionOutcome(endpoint, 'hash', signal)).resolves.toEqual({
    status: 'confirmed',
    transactionHash: 'hash',
    ledger: 50,
  });
  await expect(reads.loadTransactionOutcome(endpoint, 'hash', signal)).resolves.toEqual({
    status: 'rejected',
    transactionHash: 'hash',
  });
  await expect(reads.loadTransactionOutcome(endpoint, 'hash', signal)).rejects.toMatchObject({ kind: 'protocol' });
  expect(reads).not.toHaveProperty('submitTransaction');
  expect(reads).not.toHaveProperty('loadAccountAuthorization');
});
it.each([429, 503, 401])('preserves safe HTTP %s failure metadata and Retry-After', async status => {
  const reads = createHorizonPublicReadGateway(
    jest.fn().mockResolvedValue({ ok: false, status, headers: { get: () => '120' } }),
  );
  await expect(reads.loadAccountBalances(endpoint, 'Ga', signal)).rejects.toMatchObject({
    kind: status === 429 ? 'rate-limited' : status >= 500 ? 'unavailable' : 'request',
    retryAfterMs: 120000,
  });
});
it('distinguishes transport failure, invalid JSON, bad identity and invalid operation limits', async () => {
  const http = jest
    .fn()
    .mockRejectedValueOnce(new Error('raw private network metadata'))
    .mockResolvedValueOnce({
      ok: true,
      json: async () => {
        throw new Error('raw body');
      },
    })
    .mockResolvedValueOnce(response({ ...rawAccount, account_id: 'Gb' }));
  const reads = createHorizonPublicReadGateway(http);
  await expect(reads.loadAccountBalances(endpoint, 'Ga', signal)).rejects.toMatchObject({
    kind: 'unavailable',
    message: 'node-read-unavailable',
  });
  await expect(reads.loadAccountBalances(endpoint, 'Ga', signal)).rejects.toMatchObject({ kind: 'protocol' });
  await expect(reads.loadAccountBalances(endpoint, 'Ga', signal)).rejects.toMatchObject({ kind: 'protocol' });
  await expect(reads.loadAccountOperations(endpoint, { address: 'Ga', limit: 201 }, signal)).rejects.toMatchObject({
    kind: 'request',
  });
  expect(http).toHaveBeenCalledTimes(3);
});
it('parses delta-seconds and HTTP-date without shortening long valid Retry-After', () => {
  const now = Date.parse('2026-10-26T00:00:00Z');
  expect(retryAfterMilliseconds('120', now)).toBe(120000);
  expect(retryAfterMilliseconds('Mon, 26 Oct 2026 00:02:00 GMT', now)).toBe(120000);
  expect(retryAfterMilliseconds('86400', now)).toBe(86400000);
  for (const invalid of [null, '', '-1', 'invalid', '9'.repeat(129)])
    expect(retryAfterMilliseconds(invalid, now)).toBeUndefined();
});

it('rejects malformed balance wire values with safe protocol errors', async () => {
  for (const balance of [
    { asset_type: 'native', balance: 'NaN' },
    { asset_type: 'native', balance: 3 },
    { asset_type: 'native', balance: '1.00000001' },
    { asset_type: 'credit_alphanum4', balance: '1.0000000', asset_code: 'USD' },
    { asset_type: 'liquidity_pool_shares', balance: '1.0000000' },
    { asset_type: 'raw-private-value', balance: '1.0000000' },
  ]) {
    const reads = createHorizonPublicReadGateway(
      jest.fn().mockResolvedValue(
        response({
          ...rawAccount,
          balances: [balance],
        }),
      ),
    );
    await expect(reads.loadAccountBalances(endpoint, 'Ga', signal)).rejects.toMatchObject({
      kind: 'protocol',
      message: 'node-read-protocol',
    });
  }
});
