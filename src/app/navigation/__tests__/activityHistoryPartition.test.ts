import { activityHistoryPartitionKey } from '../activityHistoryPartition';

describe('activityHistoryPartitionKey', () => {
  it('isolates Activity state by network and classic account address', () => {
    const testnetA = activityHistoryPartitionKey({
      networkId: 'stellar-testnet',
      address: 'GACCOUNT-A',
    });
    const testnetB = activityHistoryPartitionKey({
      networkId: 'stellar-testnet',
      address: 'GACCOUNT-B',
    });
    const mainnetA = activityHistoryPartitionKey({
      networkId: 'stellar-mainnet',
      address: 'GACCOUNT-A',
    });

    expect(testnetA).not.toBe(testnetB);
    expect(testnetA).not.toBe(mainnetA);
    expect(testnetB).not.toBe(mainnetA);
  });

  it('keeps the key stable for the same network/address partition', () => {
    expect(
      activityHistoryPartitionKey({
        networkId: 'stellar-testnet',
        address: 'GACCOUNT-A',
      }),
    ).toBe(
      activityHistoryPartitionKey({
        networkId: 'stellar-testnet',
        address: 'GACCOUNT-A',
      }),
    );
  });
});
