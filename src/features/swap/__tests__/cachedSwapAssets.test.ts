import { readCachedSwapAssets } from '../cachedSwapAssets';
import { InMemoryBalanceCacheRepository } from '../../../platform/persistence/memory/InMemoryBalanceCacheRepository';
import { BALANCE_CACHE_SCHEMA_VERSION } from '../../../capabilities/balance/BalanceCacheRepository';

const account = {
  id: 'account-1',
  address: 'GSOURCE',
  networkId: 'stellar-testnet',
  identityKind: 'classic' as const,
  hidden: false,
  label: 'Main',
  sortOrder: 0,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

describe('readCachedSwapAssets', () => {
  it('prefers the stored spendable assets over raw balances', () => {
    const cache = new InMemoryBalanceCacheRepository();
    cache.replaceSnapshot(
      { networkId: account.networkId, accountAddress: account.address },
      {
        schemaVersion: BALANCE_CACHE_SCHEMA_VERSION,
        updatedAt: new Date('2026-10-23T00:00:00.000Z'),
        snapshot: {
          status: 'active',
          address: account.address,
          hiddenLiquidityPoolShareCount: 0,
          balances: [{ asset: { kind: 'native', code: 'XLM' }, balance: '9.0000000' }],
        },
        baseFeeStroops: 100,
        spendableAssets: [{ asset: { kind: 'native', code: 'XLM' }, balance: '9.0000000', spendable: '7.0000000' }],
      },
    );

    expect(readCachedSwapAssets(cache, account)).toEqual({
      authoritative: true,
      baseFeeStroops: 100,
      options: [{ asset: { kind: 'native' }, balance: '9.0000000', spendable: '7.0000000' }],
    });
  });

  it('shows saved balances before a spendable projection exists', () => {
    const cache = new InMemoryBalanceCacheRepository();
    cache.replaceSnapshot(
      { networkId: account.networkId, accountAddress: account.address },
      {
        schemaVersion: BALANCE_CACHE_SCHEMA_VERSION,
        updatedAt: new Date('2026-10-23T00:00:00.000Z'),
        snapshot: {
          status: 'active',
          address: account.address,
          hiddenLiquidityPoolShareCount: 0,
          balances: [{ asset: { kind: 'credit', code: 'USDC', issuer: 'GISSUER' }, balance: '2.0000000' }],
        },
      },
    );

    expect(readCachedSwapAssets(cache, account)?.authoritative).toBe(false);
    expect(readCachedSwapAssets(cache, account)?.options).toEqual([
      {
        asset: { kind: 'credit', code: 'USDC', issuer: 'GISSUER' },
        balance: '2.0000000',
        spendable: '2.0000000',
      },
    ]);
  });
});
