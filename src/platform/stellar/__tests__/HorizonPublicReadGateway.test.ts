import { loadHistoryPage, mapHistoryEntry } from '../../../capabilities/history/loadHistoryPage';
import { loadHistoryOperationDetails } from '../../../capabilities/history/loadHistoryOperationDetails';
import {
  cacheHistoryOnlineEntriesBestEffort,
  cacheHistoryReadyDetailBestEffort,
  readHistoryCacheSnapshotBestEffort,
} from '../../../capabilities/history/HistoryCacheHydration';
import { InMemoryHistoryCacheRepository } from '../../persistence/memory/InMemoryHistoryCacheRepository';
import { activityRowPresentation } from '../../../features/activity/activityRowPresentation';
import { matchesActivitySearch } from '../../../features/activity/activityList';
import { createLocalization } from '../../../locale/localization';
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

it('takes settled Horizon path evidence through capability, cache hydration, row and exact search', async () => {
  const address = 'G' + 'A'.repeat(55);
  const other = 'G' + 'B'.repeat(55);
  const raw = {
    ...rawOperation,
    type: 'path_payment_strict_receive',
    source_account: address,
    from: address,
    to: other,
    transaction_successful: true,
    source_amount: '922337203685.4775807',
    source_asset_type: 'native',
    amount: '0.0000001',
    asset_type: 'credit_alphanum4',
    asset_code: 'USD',
    asset_issuer: other,
    source_max: '999',
    destination_min: '888',
  };
  const http = jest
    .fn()
    .mockResolvedValueOnce(response({ _embedded: { records: [raw] } }))
    .mockResolvedValueOnce(response(raw));
  const reads = createHorizonPublicReadGateway(http);
  const account = {
    id: 'one',
    address,
    identityKind: 'classic' as const,
    networkId: 'testnet',
    label: '',
    sortOrder: 0,
    hidden: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const dependencies = {
    networkId: 'testnet',
    cache: new InMemoryHistoryCacheRepository(),
    now: () => new Date(),
    gateway: {
      loadAccountOperations: (input: Parameters<typeof loadHistoryPage>[2] & { address: string; limit: number }) =>
        reads.loadAccountOperations(endpoint, input, signal),
      loadOperation: (input: { operationId: string; accountAddress: string }) =>
        reads.loadOperation(endpoint, input, signal),
    },
  };
  const page = await loadHistoryPage(dependencies, account, { limit: 1 });
  if (page.status !== 'active') throw new Error('expected-active');
  expect(page.nextCursor).toBe(raw.paging_token);
  expect(cacheHistoryOnlineEntriesBestEffort(dependencies, account, page.entries)).toBe(true);
  const details = await loadHistoryOperationDetails(dependencies, account, raw.id);
  if (details.status !== 'ready') throw new Error('expected-ready');
  expect(cacheHistoryReadyDetailBestEffort(dependencies, account, details.entry)).toBe(true);
  const cached = readHistoryCacheSnapshotBestEffort(dependencies, account);
  expect(cached?.details[0].entry).toEqual(page.entries[0]);
  const { t, formatNumber } = createLocalization('en');
  expect(activityRowPresentation(cached!.entries[0], t, formatNumber).money).toMatchObject({
    amount: '−922,337,203,685.4775807',
    asset: { kind: 'native' },
  });
  expect(matchesActivitySearch(cached!.entries[0], '0.0000001', t, formatNumber)).toBe(true);
});

it.each([123, null])('retains malformed present sender muxed evidence as unsupported: %p', async from_muxed => {
  const address = 'G' + 'A'.repeat(55);
  const raw = {
    ...rawOperation,
    type: 'path_payment_strict_send',
    source_account: address,
    from: address,
    to: address,
    transaction_successful: true,
    source_amount: '2',
    source_asset_type: 'native',
    amount: '1',
    from_muxed,
  };
  const reads = createHorizonPublicReadGateway(
    jest.fn().mockResolvedValue(response({ _embedded: { records: [raw] } })),
  );
  const result = await reads.loadAccountOperations(endpoint, { address, limit: 1 }, signal);
  if (result.status !== 'active') throw new Error('expected-active');
  expect(mapHistoryEntry(result.records[0], address)).toMatchObject({ kind: 'unsupported', reason: 'operation-shape' });
});
