import type {AccountRecord} from '../../../capabilities/account/types';
import {
  createHomeViewModel,
  type HomeBalanceState,
} from '../homeViewModel';

const account: AccountRecord = {
  id: 'account-1',
  address: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMNO',
  identityKind: 'classic',
  networkId: 'stellar-testnet',
  label: 'Primary',
  sortOrder: 0,
  hidden: false,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const active: HomeBalanceState = {
  kind: 'ready',
  snapshot: {
    status: 'active',
    address: account.address,
    balances: [],
    hiddenLiquidityPoolShareCount: 0,
  },
};

describe('createHomeViewModel', () => {
  it('enables supported signing actions only for an active signable account', () => {
    const model = createHomeViewModel(account, true, active, {
      swap: true,
      request: true,
    });

    expect(model.canSend).toBe(true);
    expect(model.canSwap).toBe(true);
    expect(model.canRequest).toBe(true);
    expect(model.canManageAssets).toBe(true);
    expect(model.isReadOnly).toBe(false);
    expect(model.networkLabel).toBe('Testnet');
  });

  it('keeps signing and trustline actions disabled for a watch-only account', () => {
    const model = createHomeViewModel(account, false, active, {
      swap: true,
      request: true,
    });

    expect(model.canSend).toBe(false);
    expect(model.canSwap).toBe(false);
    expect(model.canManageAssets).toBe(false);
    expect(model.canRequest).toBe(true);
    expect(model.isReadOnly).toBe(true);
  });

  it('does not enable ledger mutation actions before the account is active', () => {
    const inactive: HomeBalanceState = {
      kind: 'ready',
      snapshot: {status: 'inactive', address: account.address},
    };
    const model = createHomeViewModel(account, true, inactive, {
      swap: true,
      request: false,
    });

    expect(model.canSend).toBe(false);
    expect(model.canSwap).toBe(false);
    expect(model.canManageAssets).toBe(false);
    expect(model.canRequest).toBe(false);
  });

  it('treats contract accounts as non-signable in the classic Home action set', () => {
    const contractAccount: AccountRecord = {
      ...account,
      identityKind: 'contract',
      address: 'CABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMNO',
    };
    const model = createHomeViewModel(
      contractAccount,
      true,
      {
        kind: 'ready',
        snapshot: {
          status: 'unsupported-account',
          address: contractAccount.address,
        },
      },
      {swap: true, request: false},
    );

    expect(model.isReadOnly).toBe(true);
    expect(model.canSend).toBe(false);
    expect(model.canSwap).toBe(false);
    expect(model.canManageAssets).toBe(false);
  });
});
