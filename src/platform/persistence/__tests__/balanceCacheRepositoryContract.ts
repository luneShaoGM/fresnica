import {
  BALANCE_CACHE_MAX_LINES,
  normalizeBalanceCacheSnapshot,
  type BalanceCachePartition,
  type BalanceCacheRepository,
  type BalanceCacheSnapshot,
} from '../../../capabilities/balance/BalanceCacheRepository';

export const balancePartition: BalanceCachePartition = { networkId: 'stellar-testnet', accountAddress: 'GA' };
export function balanceSnapshot(address = 'GA'): BalanceCacheSnapshot {
  return {
    schemaVersion: 1,
    lastSuccessfulUpdateAt: new Date('2026-10-26T00:00:00Z'),
    balance: {
      status: 'active',
      address,
      balances: [
        { asset: { kind: 'native', code: 'XLM' }, balance: '9007199254740993.0000001' },
        { asset: { kind: 'credit', code: 'MiXeD', issuer: 'GISSUER' }, balance: '1.0000000', limit: '100.0000000' },
      ],
      hiddenLiquidityPoolShareCount: 1,
    },
  };
}
export function runBalanceCacheRepositoryContract(createRepository: () => BalanceCacheRepository) {
  it('stores canonical public fields without losing decimal precision and returns detached dates', () => {
    const repository = createRepository();
    const polluted = {
      ...balanceSnapshot(),
      secret: 'must-not-save',
      balance: { ...balanceSnapshot().balance, _links: 'raw' },
    };
    repository.replaceSnapshot(balancePartition, polluted);
    const result = repository.getSnapshot(balancePartition);
    expect(result).toEqual(balanceSnapshot());
    expect(JSON.stringify(result)).not.toContain('must-not-save');
    expect(JSON.stringify(result)).not.toContain('_links');
    result?.lastSuccessfulUpdateAt.setTime(0);
    expect(repository.getSnapshot(balancePartition)).toEqual(balanceSnapshot());
  });
  it('isolates network/address and ignores object property insertion order', () => {
    const repository = createRepository();
    repository.replaceSnapshot(balancePartition, balanceSnapshot());
    repository.replaceSnapshot(
      { networkId: 'stellar-mainnet', accountAddress: 'GA' },
      { ...balanceSnapshot(), balance: { status: 'inactive', address: 'GA' } },
    );
    repository.replaceSnapshot({ networkId: 'stellar-testnet', accountAddress: 'GB' }, balanceSnapshot('GB'));
    expect(repository.getSnapshot({ accountAddress: 'GA', networkId: 'stellar-testnet' })).toEqual(balanceSnapshot());
    expect(repository.getSnapshot({ networkId: 'stellar-mainnet', accountAddress: 'GA' })?.balance.status).toBe(
      'inactive',
    );
    expect(repository.getSnapshot({ networkId: 'stellar-testnet', accountAddress: 'GB' })?.balance.address).toBe('GB');
  });
  it.each([
    ['address', { ...balanceSnapshot(), balance: { status: 'inactive', address: 'GB' } }],
    ['version', { ...balanceSnapshot(), schemaVersion: 2 }],
    ['time', { ...balanceSnapshot(), lastSuccessfulUpdateAt: new Date(NaN) }],
    ['unsupported', { ...balanceSnapshot(), balance: { status: 'unsupported-account', address: 'GA' } }],
    [
      'decimal',
      {
        ...balanceSnapshot(),
        balance: {
          status: 'active',
          address: 'GA',
          hiddenLiquidityPoolShareCount: 0,
          balances: [{ asset: { kind: 'native', code: 'XLM' }, balance: '1e9' }],
        },
      },
    ],
    [
      'duplicate',
      {
        ...balanceSnapshot(),
        balance: {
          status: 'active',
          address: 'GA',
          hiddenLiquidityPoolShareCount: 0,
          balances: Array(2).fill({ asset: { kind: 'native', code: 'XLM' }, balance: '1' }),
        },
      },
    ],
    [
      'size',
      {
        ...balanceSnapshot(),
        balance: {
          status: 'active',
          address: 'GA',
          hiddenLiquidityPoolShareCount: 0,
          balances: Array(BALANCE_CACHE_MAX_LINES + 1).fill({ asset: { kind: 'native', code: 'XLM' }, balance: '1' }),
        },
      },
    ],
  ])('rejects invalid %s without replacing a valid snapshot', (_name, invalid) => {
    const repository = createRepository();
    repository.replaceSnapshot(balancePartition, balanceSnapshot());
    expect(() => repository.replaceSnapshot(balancePartition, invalid as BalanceCacheSnapshot)).toThrow();
    expect(repository.getSnapshot(balancePartition)).toEqual(balanceSnapshot());
  });
  it('replaces an active cache with a live inactive snapshot and clears only the requested partition', () => {
    const repository = createRepository();
    repository.replaceSnapshot(balancePartition, balanceSnapshot());
    const inactive = normalizeBalanceCacheSnapshot(balancePartition, {
      ...balanceSnapshot(),
      balance: { status: 'inactive', address: 'GA' },
    });
    repository.replaceSnapshot(balancePartition, inactive);
    repository.replaceSnapshot({ networkId: 'stellar-testnet', accountAddress: 'GB' }, balanceSnapshot('GB'));
    expect(repository.getSnapshot(balancePartition)).toEqual(inactive);
    repository.clearPartition(balancePartition);
    expect(repository.getSnapshot(balancePartition)).toBeUndefined();
    expect(repository.getSnapshot({ networkId: 'stellar-testnet', accountAddress: 'GB' })).toEqual(
      balanceSnapshot('GB'),
    );
  });
}
