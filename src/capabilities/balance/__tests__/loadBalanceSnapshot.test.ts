import {loadBalanceSnapshot} from '../loadBalanceSnapshot';
import type {AccountRecord} from '../../account/types';
import type {StellarGateway} from '../../../platform/stellar/StellarGateway';

const NOW = new Date('2026-08-31T00:00:00.000Z');

function account(overrides: Partial<AccountRecord> = {}): AccountRecord {
  return {
    id: 'account-1',
    address: 'GTEST',
    identityKind: 'classic',
    networkId: 'stellar-testnet',
    label: 'Primary',
    sortOrder: 0,
    hidden: false,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function gateway(): jest.Mocked<StellarGateway> {
  return {
    loadAccountAuthorization: jest.fn(),
    loadAccountBalances: jest.fn(),
    buildPayment: jest.fn(),
    submitTransaction: jest.fn(),
  };
}

describe('loadBalanceSnapshot', () => {
  it('normalizes native and issued assets while keeping exact balance strings', async () => {
    const stellar = gateway();
    stellar.loadAccountBalances.mockResolvedValue({
      status: 'active',
      address: 'GTEST',
      balances: [
        {kind: 'native', balance: '12.3456789'},
        {kind: 'credit', balance: '7.0000001', code: 'USD', issuer: 'GISSUER'},
      ],
    });

    await expect(loadBalanceSnapshot({gateway: stellar}, account())).resolves.toEqual({
      status: 'active',
      address: 'GTEST',
      balances: [
        {asset: {kind: 'native', code: 'XLM'}, balance: '12.3456789'},
        {
          asset: {kind: 'credit', code: 'USD', issuer: 'GISSUER'},
          balance: '7.0000001',
        },
      ],
      hiddenLiquidityPoolShareCount: 0,
    });
  });

  it('keeps liquidity-pool shares out of the token list until that product model exists', async () => {
    const stellar = gateway();
    stellar.loadAccountBalances.mockResolvedValue({
      status: 'active',
      address: 'GTEST',
      balances: [
        {kind: 'native', balance: '1.0000000'},
        {kind: 'liquidity-pool-share', balance: '0.5000000', liquidityPoolId: 'pool'},
      ],
    });

    await expect(loadBalanceSnapshot({gateway: stellar}, account())).resolves.toEqual({
      status: 'active',
      address: 'GTEST',
      balances: [{asset: {kind: 'native', code: 'XLM'}, balance: '1.0000000'}],
      hiddenLiquidityPoolShareCount: 1,
    });
  });

  it('preserves the inactive account state', async () => {
    const stellar = gateway();
    stellar.loadAccountBalances.mockResolvedValue({status: 'inactive', address: 'GTEST'});

    await expect(loadBalanceSnapshot({gateway: stellar}, account())).resolves.toEqual({
      status: 'inactive',
      address: 'GTEST',
    });
  });

  it('does not query Classic Horizon balances for contract accounts', async () => {
    const stellar = gateway();

    await expect(
      loadBalanceSnapshot(
        {gateway: stellar},
        account({identityKind: 'contract', address: 'CTEST'}),
      ),
    ).resolves.toEqual({status: 'unsupported-account', address: 'CTEST'});
    expect(stellar.loadAccountBalances).not.toHaveBeenCalled();
  });

  it('fails closed when a persisted account belongs to another network', async () => {
    const stellar = gateway();

    await expect(
      loadBalanceSnapshot({gateway: stellar}, account({networkId: 'stellar-mainnet'})),
    ).rejects.toThrow('balance-network-mismatch:stellar-mainnet');
    expect(stellar.loadAccountBalances).not.toHaveBeenCalled();
  });
});
