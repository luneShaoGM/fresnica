import { InMemoryBalanceCacheRepository } from '../InMemoryBalanceCacheRepository';
import {
  BALANCE_CACHE_SCHEMA_VERSION,
  deserializeBalanceCachePayload,
  serializeBalanceCachePayload,
} from '../../../../capabilities/balance/BalanceCacheRepository';

const partition = { networkId: 'stellar-testnet', accountAddress: 'GSOURCE' };
const record = {
  schemaVersion: BALANCE_CACHE_SCHEMA_VERSION,
  updatedAt: new Date('2026-10-23T00:00:00.000Z'),
  snapshot: {
    status: 'active' as const,
    address: 'GSOURCE',
    hiddenLiquidityPoolShareCount: 0,
    balances: [{ asset: { kind: 'native' as const, code: 'XLM' as const }, balance: '1.0000000' }],
  },
};

describe('InMemoryBalanceCacheRepository', () => {
  it('returns a normalized copy and isolates partitions', () => {
    const cache = new InMemoryBalanceCacheRepository();
    cache.replaceSnapshot(partition, record);

    const stored = cache.getSnapshot(partition);
    expect(stored?.snapshot).toEqual(record.snapshot);
    expect(stored).not.toBe(record);
    expect(cache.getSnapshot({ ...partition, accountAddress: 'GOTHER' })).toBeUndefined();

    cache.clearPartition(partition);
    expect(cache.getSnapshot(partition)).toBeUndefined();
  });

  it('keeps spendable assets inside the persisted payload and still reads older balance-only blobs', () => {
    const updatedAt = new Date('2026-10-23T00:00:00.000Z');
    const withSpendable = {
      ...record,
      baseFeeStroops: 100,
      spendableAssets: [
        { asset: { kind: 'native' as const, code: 'XLM' as const }, balance: '9.0000000', spendable: '7.0000000' },
      ],
    };
    const restored = deserializeBalanceCachePayload(serializeBalanceCachePayload(withSpendable), updatedAt);
    expect(restored.spendableAssets).toEqual(withSpendable.spendableAssets);
    expect(restored.baseFeeStroops).toBe(100);

    const legacy = deserializeBalanceCachePayload(JSON.stringify(record.snapshot), updatedAt);
    expect(legacy.snapshot).toEqual(record.snapshot);
    expect(legacy.spendableAssets).toBeUndefined();
  });
});
