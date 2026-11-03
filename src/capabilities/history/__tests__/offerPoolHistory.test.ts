import type { AccountRecord } from '../../account/types';
import type { HistoryOperationRecord } from '../HistoryGateway';
import { normalizeHistoryCacheSnapshot } from '../HistoryCacheRepository';
import { loadHistoryOperationDetails } from '../loadHistoryOperationDetails';
import { mapHistoryEntry } from '../loadHistoryPage';
import type { HistoryEntry } from '../types';

const address = 'G' + 'A'.repeat(55);
const issuer = 'G' + 'B'.repeat(55);
const other = 'G' + 'C'.repeat(55);
const native = { kind: 'native' } as const;
const credit = { kind: 'credit', code: 'XLM', issuer } as const;
const base: HistoryOperationRecord = {
  id: 'op',
  pagingToken: 'cursor',
  type: 'manage_buy_offer',
  occurredAt: '2026-11-03T00:00:00Z',
  transactionHash: 'tx',
  sourceAccount: address,
  successful: true,
  buyingAsset: credit,
  sellingAsset: native,
  amount: '922337203685.4775807',
  offerId: '9223372036854775807',
  price: { n: 2147483647, d: 1 },
};
const pool: HistoryOperationRecord = {
  ...base,
  type: 'liquidity_pool_deposit',
  poolId: 'a'.repeat(64),
  shares: '0.0000001',
  reserves: [
    { asset: native, amount: '0' },
    { asset: credit, amount: '922337203685.4775807' },
  ],
};
function snapshot(entry: HistoryEntry) {
  return {
    schemaVersion: 1 as const,
    lastSuccessfulHorizonUpdateAt: new Date(),
    entries: [entry],
    details: [{ operationId: entry.id, entry }],
  };
}
function normalize(entry: HistoryEntry) {
  return normalizeHistoryCacheSnapshot(snapshot(entry), { networkId: 'testnet', accountAddress: address });
}
it.each(['manage_buy_offer', 'manage_sell_offer', 'create_passive_sell_offer'])(
  'retains exact %s instruction with no direction or settlement amount',
  type => {
    const entry = mapHistoryEntry({ ...base, type }, address);
    expect(entry).toMatchObject({
      kind: 'offer',
      amount: base.amount,
      offerId: base.offerId,
      cancellation: false,
      price: base.price,
    });
    expect(entry).not.toHaveProperty('direction');
    expect(normalize(entry).entries[0]).toEqual(entry);
  },
);
it.each(['manage_buy_offer', 'manage_sell_offer'])('derives zero %s cancellation only', type => {
  expect(mapHistoryEntry({ ...base, type, amount: '000.0000000' }, address)).toMatchObject({
    kind: 'offer',
    cancellation: true,
  });
});
it('accepts passive with no ID, distinguishes asset issuers and code case', () => {
  expect(mapHistoryEntry({ ...base, type: 'create_passive_sell_offer', offerId: undefined }, address).kind).toBe(
    'offer',
  );
  for (const sellingAsset of [
    { ...credit, issuer: other },
    { ...credit, code: 'xlm' },
  ])
    expect(mapHistoryEntry({ ...base, sellingAsset }, address).kind).toBe('offer');
});
it.each([
  { successful: false },
  { successful: undefined },
  { successful: 'true' },
  { amount: '-1' },
  { amount: '1e2' },
  { amount: '0.00000001' },
  { amount: '922337203685.4775808' },
  { amount: 1 },
  { offerId: 9223372036854775807 },
  { offerId: '9223372036854775808' },
  { offerId: '-1' },
  { offerId: '1.0' },
  { offerId: undefined },
  { price: { n: 0, d: 1 } },
  { price: { n: 1, d: -1 } },
  { price: { n: 2147483648, d: 1 } },
  { price: { n: 1.1, d: 1 } },
  { price: { n: '1', d: 1 } },
  { price: undefined },
  { buyingAsset: native },
  { buyingAsset: { ...credit, issuer: 'bad' } },
  { buyingAsset: { ...credit, code: 'BAD!' } },
  { sourceAccount: issuer },
  { sourceAccount: ` ${address}` },
  { type: 'create_passive_sell_offer', amount: '0' },
])('falls back with no money for invalid offer evidence %p', patch => {
  expect(mapHistoryEntry({ ...base, ...patch } as HistoryOperationRecord, address)).toMatchObject({
    kind: 'unsupported',
    reason: 'operation-shape',
    id: base.id,
  });
});
it.each(['liquidity_pool_deposit', 'liquidity_pool_withdraw'])(
  'preserves actual ordered reserves and shares for %s',
  type => {
    const entry = mapHistoryEntry({ ...pool, type }, address);
    expect(entry).toMatchObject({ kind: 'liquidity-pool', reserves: pool.reserves, shares: pool.shares });
    expect(normalize(entry).entries[0]).toEqual(entry);
  },
);
it.each([
  { successful: undefined },
  { successful: 'true' },
  { poolId: 'A'.repeat(64) },
  { poolId: 'a'.repeat(63) },
  { shares: '0' },
  { shares: '1.00000001' },
  { shares: '922337203685.4775808' },
  { shares: 1 },
  { sourceAccount: issuer },
  { sourceAccount: ` ${address}` },
  { reserves: undefined },
  { reserves: [] },
  { reserves: [pool.reserves![0]] },
  { reserves: [...pool.reserves!, pool.reserves![0]] },
  { reserves: [null, pool.reserves![1]] },
  {
    reserves: [
      { asset: native, amount: '0' },
      { asset: credit, amount: '0.0000000' },
    ],
  },
  {
    reserves: [
      { asset: native, amount: '1' },
      { asset: native, amount: '2' },
    ],
  },
  {
    reserves: [
      { asset: native, amount: '1' },
      { asset: credit, amount: '-1' },
    ],
  },
  {
    reserves: [
      { asset: native, amount: '1' },
      { asset: credit, amount: '922337203685.4775808' },
    ],
  },
])('rejects malformed actual pool evidence %p', patch => {
  expect(mapHistoryEntry({ ...pool, ...patch } as HistoryOperationRecord, address)).toMatchObject({
    kind: 'unsupported',
    reason: 'operation-shape',
  });
});
it.each([base, pool])('rejects foreign detail despite injected from/to and issuer references', async record => {
  const gateway = {
    loadAccountOperations: jest.fn(),
    loadOperation: jest
      .fn()
      .mockResolvedValue({ status: 'found', record: { ...record, sourceAccount: other, from: address, to: address } }),
  };
  expect(
    await loadHistoryOperationDetails(
      { networkId: 'testnet', gateway },
      { address, networkId: 'testnet', identityKind: 'classic' } as AccountRecord,
      record.id,
    ),
  ).toEqual({ status: 'not-associated' });
});
it.each([base, pool])(
  'strips unknown cache fields, freezes owned payloads and rejects foreign partition or changed success',
  record => {
    const entry = mapHistoryEntry(record, address);
    const dirty = JSON.parse(JSON.stringify(entry));
    dirty.localName = 'private';
    if (dirty.kind === 'offer') {
      dirty.price.secret = 'secret';
      dirty.buyingAsset.secret = 'secret';
    } else {
      dirty.reserves[0].secret = 'secret';
      dirty.reserves[0].asset.secret = 'secret';
    }
    const result = normalize(dirty).entries[0];
    expect(result).toEqual(entry);
    expect(Object.isFrozen(result)).toBe(true);
    if (result.kind === 'offer') {
      expect(Object.isFrozen(result.price)).toBe(true);
      expect(Object.isFrozen(result.buyingAsset)).toBe(true);
    }
    if (result.kind === 'liquidity-pool') {
      expect(Object.isFrozen(result.reserves)).toBe(true);
      expect(Object.isFrozen(result.reserves[0].asset)).toBe(true);
    }
    expect(() =>
      normalizeHistoryCacheSnapshot(snapshot(entry), { networkId: 'testnet', accountAddress: other }),
    ).toThrow();
    expect(() => normalize({ ...entry, successful: false } as unknown as HistoryEntry)).toThrow();
    const legacy = { ...entry, kind: 'unsupported', reason: 'operation-type' } as HistoryEntry;
    expect(normalize(legacy).entries[0]).toMatchObject({ kind: 'unsupported', reason: 'operation-type' });
  },
);
it('rejects mutated cancellation, native code, family, actual limits and list/detail mismatch', () => {
  const offer = mapHistoryEntry(base, address);
  const deposit = mapHistoryEntry(pool, address);
  if (offer.kind !== 'offer' || deposit.kind !== 'liquidity-pool') throw new Error('expected-family');
  for (const corrupt of [
    { ...offer, cancellation: true },
    { ...offer, sellingAsset: { kind: 'native', code: 'USD' } },
    { ...offer, operationType: 'payment' },
    { ...deposit, reserves: [{ asset: { kind: 'native', code: 'USD' }, amount: '1' }, deposit.reserves[1]] },
  ])
    expect(() => normalize(corrupt as HistoryEntry)).toThrow();
  expect(() =>
    normalizeHistoryCacheSnapshot({
      ...snapshot(offer),
      details: [{ operationId: offer.id, entry: { ...offer, amount: '1' } }],
    }),
  ).toThrow('history-cache-detail-mismatch');
  expect(() =>
    normalize({ ...deposit, reserves: undefined, reservesMax: pool.reserves } as unknown as HistoryEntry),
  ).toThrow();
  expect(() =>
    normalize({ ...offer, kind: 'unsupported', operationType: 'future', reason: 'operation-shape' } as HistoryEntry),
  ).toThrow();
});
