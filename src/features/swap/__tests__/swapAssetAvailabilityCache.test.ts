import { createSwapAssetAvailabilityCache } from '../swapAssetAvailabilityCache';

describe('Swap asset availability cache', () => {
  it('partitions snapshots by network and account and does not retain caller arrays', () => {
    const cache = createSwapAssetAvailabilityCache();
    const options = [{ asset: { kind: 'native' as const }, balance: '10.0000000', spendable: '7.4999900' }];
    cache.set('stellar-testnet', 'account-a', { options, baseFeeStroops: 100 });

    expect(cache.get('stellar-testnet', 'account-a')).toEqual({ options, baseFeeStroops: 100 });
    expect(cache.get('stellar-testnet', 'account-b')).toBeUndefined();
    expect(cache.get('stellar-mainnet', 'account-a')).toBeUndefined();

    cache.remove('stellar-testnet', 'account-a');
    expect(cache.get('stellar-testnet', 'account-a')).toBeUndefined();
  });
});
