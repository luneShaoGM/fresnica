import { loadHistoryPage, mapHistoryEntry } from '../../../capabilities/history/loadHistoryPage';
import { loadHistoryOperationDetails } from '../../../capabilities/history/loadHistoryOperationDetails';
import {
  cacheHistoryOnlineEntriesBestEffort,
  cacheHistoryReadyDetailBestEffort,
  readHistoryCacheSnapshotBestEffort,
} from '../../../capabilities/history/HistoryCacheHydration';
import { InMemoryHistoryCacheRepository } from '../../persistence/memory/InMemoryHistoryCacheRepository';
import { activityRowPresentation } from '../../../features/activity/activityRowPresentation';
import { matchesActivityFilter, matchesActivitySearch } from '../../../features/activity/activityList';
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
    'https://node.test/accounts/Ga/operations?include_failed=true&join=transactions&order=desc&limit=1&cursor=opaque%2Bcursor',
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

const offerAddress = 'G' + 'A'.repeat(55);
const offerIssuer = 'G' + 'B'.repeat(55);
function rawOffer(type = 'manage_buy_offer') {
  return {
    ...rawOperation,
    type,
    source_account: offerAddress,
    transaction_successful: true,
    buying_asset_type: 'credit_alphanum4',
    buying_asset_code: 'XLM',
    buying_asset_issuer: offerIssuer,
    selling_asset_type: 'native',
    amount: '922337203685.4775807',
    price_r: { n: 2147483647, d: 3 },
    offer_id: '9223372036854775807',
  };
}
function rawPool(type = 'liquidity_pool_deposit') {
  return {
    ...rawOffer(type),
    liquidity_pool_id: 'a'.repeat(64),
    reserves_deposited: [
      { asset: 'native', amount: '0' },
      { asset: `XLM:${offerIssuer}`, amount: '922337203685.4775807' },
    ],
    reserves_received: [
      { asset: `USD:${offerIssuer}`, amount: '0.0000001' },
      { asset: 'native', amount: '2' },
    ],
    shares_received: '1.0000000',
    shares: '2',
    reserves_max: [{ asset: 'native', amount: '888' }],
    reserves_min: [{ asset: 'native', amount: '999' }],
  };
}
it.each([
  'manage_buy_offer',
  'manage_sell_offer',
  'create_passive_sell_offer',
  'liquidity_pool_deposit',
  'liquidity_pool_withdraw',
])('takes successful raw %s through PublicRead, History, list/detail cache and presentation', async type => {
  const raw = type.startsWith('liquidity_pool') ? rawPool(type) : rawOffer(type);
  const reads = createHorizonPublicReadGateway(
    jest
      .fn()
      .mockResolvedValueOnce(response({ _embedded: { records: [raw] } }))
      .mockResolvedValueOnce(response(raw)),
  );
  const account = {
    id: 'one',
    address: offerAddress,
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
      loadAccountOperations: (input: { address: string; limit: number; cursor?: string }) =>
        reads.loadAccountOperations(endpoint, input, signal),
      loadOperation: (input: { operationId: string; accountAddress: string }) =>
        reads.loadOperation(endpoint, input, signal),
    },
  };
  const page = await loadHistoryPage(dependencies, account, { limit: 1 });
  if (page.status !== 'active') throw new Error('expected-active');
  expect(page.nextCursor).toBe(raw.paging_token);
  expect(cacheHistoryOnlineEntriesBestEffort(dependencies, account, page.entries)).toBe(true);
  const detail = await loadHistoryOperationDetails(dependencies, account, raw.id);
  if (detail.status !== 'ready') throw new Error('expected-ready');
  expect(cacheHistoryReadyDetailBestEffort(dependencies, account, detail.entry)).toBe(true);
  const snapshot = readHistoryCacheSnapshotBestEffort(dependencies, account);
  expect(snapshot?.details[0].entry).toEqual(page.entries[0]);
  const entry = snapshot!.entries[0];
  const { t, formatNumber } = createLocalization('en');
  const row = activityRowPresentation(entry, t, formatNumber);
  expect(matchesActivityFilter(entry, 'other')).toBe(true);
  expect(matchesActivityFilter(entry, 'payments')).toBe(false);
  if (entry.kind === 'offer') {
    expect(row.title).toBe('XLM / XLM');
    expect(row.money).toBeUndefined();
    expect(row.reserveMoney).toBeUndefined();
    expect(entry.offerId).toBe('9223372036854775807');
    for (const query of [
      entry.amount,
      '922,337,203,685.4775807',
      offerIssuer,
      entry.offerId!,
      '2147483647',
      '3',
      row.operation,
      offerAddress,
    ])
      expect(matchesActivitySearch(entry, query, t, formatNumber)).toBe(true);
  } else {
    expect(entry.kind).toBe('liquidity-pool');
    expect(row.reserveMoney).toMatchObject(
      type === 'liquidity_pool_deposit'
        ? [
            { amount: '−0', tone: 'negative', asset: { kind: 'native' } },
            { amount: '−922,337,203,685.4775807', tone: 'negative', asset: { kind: 'credit' } },
          ]
        : [
            { amount: '+0.0000001', tone: 'positive', asset: { code: 'USD' } },
            { amount: '+2', tone: 'positive', asset: { kind: 'native' } },
          ],
    );
    for (const query of [
      'a'.repeat(64),
      row.operation,
      offerIssuer,
      offerAddress,
      type === 'liquidity_pool_deposit' ? '1.0000000' : '0.0000001',
    ])
      expect(matchesActivitySearch(entry, query, t, formatNumber)).toBe(true);
    expect(matchesActivitySearch(entry, '888', t, formatNumber)).toBe(false);
    expect(matchesActivitySearch(entry, '999', t, formatNumber)).toBe(false);
  }
});
it.each([
  { ...rawOffer(), transaction_successful: undefined },
  { ...rawOffer(), transaction_successful: 'true' },
  { ...rawOffer(), offer_id: 9223372036854775807 },
  { ...rawOffer('create_passive_sell_offer'), offer_id: 12 },
  { ...rawOffer(), price_r: { n: '1', d: 2 } },
  { ...rawOffer(), price_r: [1, 2] },
  { ...rawPool(), reserves_deposited: undefined },
  { ...rawPool(), reserves_deposited: [{ asset: 'native', amount: '1' }] },
  {
    ...rawPool(),
    reserves_deposited: [
      { asset: 'native', amount: '1' },
      { asset: `USD:${offerIssuer}:extra`, amount: '1' },
    ],
  },
  {
    ...rawPool(),
    reserves_deposited: [
      { asset: 'native', amount: 1 },
      { asset: `USD:${offerIssuer}`, amount: '1' },
    ],
  },
  { ...rawPool(), reserves_deposited: [null, { asset: 'native', amount: '1' }] },
  {
    ...rawPool(),
    reserves_deposited: [
      { asset: 'native', amount: '1' },
      { asset: `USD:${offerIssuer}`, amount: '1' },
      { asset: 'native', amount: '2' },
    ],
  },
  { ...rawPool(), shares_received: 1 },
])('does not rescue malformed raw family evidence with quantity/limit fields: %p', async raw => {
  const reads = createHorizonPublicReadGateway(
    jest.fn().mockResolvedValue(response({ _embedded: { records: [raw] } })),
  );
  const result = await reads.loadAccountOperations(endpoint, { address: offerAddress, limit: 1 }, signal);
  if (result.status !== 'active') throw new Error('expected-active');
  expect(mapHistoryEntry(result.records[0], offerAddress)).toMatchObject({
    kind: 'unsupported',
    reason: 'operation-shape',
  });
});

const claimableCreator = `G${'E'.repeat(55)}`;
const claimableDestination = `G${'F'.repeat(55)}`;
const claimableIssuer = `G${'G'.repeat(55)}`;
const claimableBalanceId = `00000000${'b'.repeat(64)}`;
function rawClaimable(type: string) {
  return {
    id: 'claimable-op',
    paging_token: '9007199254740999',
    type,
    created_at: '2026-11-03T00:00:00Z',
    transaction_hash: 'claimable-hash',
    transaction_successful: true,
    source_account: type === 'clawback' ? claimableIssuer : claimableCreator,
    asset: `XLM:${claimableIssuer}`,
    asset_type: 'credit_alphanum4',
    asset_code: 'XLM',
    asset_issuer: claimableIssuer,
    amount: '922337203685.4775807',
    from: claimableCreator,
    claimants: [
      {
        destination: claimableDestination,
        predicate: {
          and: [
            { absBefore: '+39121901036-03-29T15:30:22Z', absBeforeEpoch: '1234567890123456789' },
            { not: { rel_before: '-1' } },
          ],
        },
      },
    ],
    claimant: claimableCreator,
    balance_id: claimableBalanceId,
  };
}
it.each(['create_claimable_balance', 'claim_claimable_balance', 'clawback', 'clawback_claimable_balance'])(
  'takes raw %s through public reads, History, offline cache, list/detail and search without extra lookups',
  async type => {
    const raw = rawClaimable(type);
    const http = jest
      .fn()
      .mockResolvedValueOnce(response({ _embedded: { records: [raw] } }))
      .mockResolvedValueOnce(response(raw));
    const reads = createHorizonPublicReadGateway(http);
    const account = {
      id: 'claimable',
      address: claimableCreator,
      networkId: 'testnet',
      identityKind: 'classic' as const,
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
        loadAccountOperations: (input: { address: string; limit: number; cursor?: string }) =>
          reads.loadAccountOperations(endpoint, input, signal),
        loadOperation: (input: { operationId: string; accountAddress: string }) =>
          reads.loadOperation(endpoint, input, signal),
      },
    };
    const page = await loadHistoryPage(dependencies, account, { limit: 1 });
    if (page.status !== 'active') throw new Error('expected-active');
    expect(page.nextCursor).toBe(raw.paging_token);
    expect(cacheHistoryOnlineEntriesBestEffort(dependencies, account, page.entries)).toBe(true);
    const detail = await loadHistoryOperationDetails(dependencies, account, raw.id);
    if (detail.status !== 'ready') throw new Error('expected-ready');
    expect(detail.entry.kind).not.toBe('unsupported');
    expect(cacheHistoryReadyDetailBestEffort(dependencies, account, detail.entry)).toBe(true);
    const cached = readHistoryCacheSnapshotBestEffort(dependencies, account)!;
    expect(cached.entries[0]).toEqual(detail.entry);
    expect(cached.details[0].entry).toEqual(detail.entry);
    const entry = cached.entries[0];
    const { t, formatNumber } = createLocalization('en');
    expect(matchesActivityFilter(entry, 'other')).toBe(true);
    expect(matchesActivitySearch(entry, type, t, formatNumber)).toBe(true);
    const row = activityRowPresentation(entry, t, formatNumber);
    if (type === 'create_claimable_balance' || type === 'clawback') {
      expect(row.subject).toMatchObject({
        kind: 'asset',
        asset: { kind: 'credit', code: 'XLM', issuer: claimableIssuer },
      });
      expect(row.money?.amount).toBe('−922,337,203,685.4775807');
      expect(matchesActivitySearch(entry, claimableIssuer, t, formatNumber)).toBe(true);
    } else {
      expect(row.money).toBeUndefined();
      expect(matchesActivitySearch(entry, claimableBalanceId, t, formatNumber)).toBe(true);
      expect(entry).not.toHaveProperty('asset');
    }
    expect(http).toHaveBeenCalledTimes(2);
  },
);
it.each(['create_claimable_balance', 'claim_claimable_balance', 'clawback', 'clawback_claimable_balance'])(
  'requires literal success for raw %s and keeps unsupported shape visible',
  async type => {
    for (const transaction_successful of [undefined, 'true']) {
      const raw = { ...rawClaimable(type), transaction_successful };
      const reads = createHorizonPublicReadGateway(jest.fn().mockResolvedValue(response(raw)));
      const result = await reads.loadOperation(
        endpoint,
        { operationId: raw.id, accountAddress: claimableCreator },
        signal,
      );
      if (result.status !== 'found') throw new Error('expected-found');
      expect(mapHistoryEntry(result.record, claimableCreator)).toMatchObject({
        kind: 'unsupported',
        reason: 'operation-shape',
      });
    }
  },
);
