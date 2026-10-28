import type { AccountRecord } from '../../../capabilities/account/types';
import { createHomeViewModel, type HomeBalanceState } from '../homeViewModel';

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
  stale: false,
  refreshing: false,
  refreshFailed: false,
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
    expect(model.canFundWithFriendbot).toBe(false);
    expect(model.isReadOnly).toBe(false);
    expect(model.networkLabel).toBe('Testnet');
  });

  it.each(['active', 'inactive'] as const)(
    'keeps the Swap entry available but gates ledger actions from a stale %s snapshot',
    status => {
      const stale: HomeBalanceState = {
        ...active,
        stale: true,
        snapshot: status === 'active' ? active.snapshot : { status: 'inactive', address: account.address },
      };
      const model = createHomeViewModel(account, true, stale, { swap: true, request: true, friendbot: true });
      expect(model.canSend).toBe(false);
      expect(model.canSwap).toBe(true);
      expect(model.canManageAssets).toBe(false);
      expect(model.canFundWithFriendbot).toBe(false);
      expect(model.canRequest).toBe(true);
    },
  );

  it('does not show Swap when the parent entry gate is unavailable', () => {
    expect(createHomeViewModel(account, true, active, { swap: false, request: true }).canSwap).toBe(false);
  });

  it.each(['loading', 'error'] as const)(
    'allows eligible Classic accounts to open Swap when Home balance is %s',
    kind => {
      const balance = kind === 'loading' ? ({ kind } as const) : ({ kind, message: 'offline' } as const);
      const model = createHomeViewModel(account, true, balance, { swap: true, request: true });
      expect(model.canSwap).toBe(true);
      expect(model.canSend).toBe(false);
      expect(model.canManageAssets).toBe(false);
    },
  );

  it('keeps signing and trustline actions disabled for a watch-only account', () => {
    const model = createHomeViewModel(account, false, active, {
      swap: true,
      request: true,
    });

    expect(model.canSend).toBe(false);
    expect(model.canSwap).toBe(false);
    expect(model.canManageAssets).toBe(false);
    expect(model.canFundWithFriendbot).toBe(false);
    expect(model.canRequest).toBe(true);
    expect(model.isReadOnly).toBe(true);
  });

  it('keeps Send and asset management disabled before the account is active', () => {
    const inactive: HomeBalanceState = {
      kind: 'ready',
      stale: false,
      refreshing: false,
      refreshFailed: false,
      snapshot: { status: 'inactive', address: account.address },
    };
    const model = createHomeViewModel(account, true, inactive, {
      swap: true,
      request: false,
      friendbot: true,
    });

    expect(model.canSend).toBe(false);
    expect(model.canSwap).toBe(true);
    expect(model.canManageAssets).toBe(false);
    expect(model.canFundWithFriendbot).toBe(true);
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
        stale: false,
        refreshing: false,
        refreshFailed: false,
        snapshot: {
          status: 'unsupported-account',
          address: contractAccount.address,
        },
      },
      { swap: true, request: false },
    );

    expect(model.isReadOnly).toBe(true);
    expect(model.canSend).toBe(false);
    expect(model.canSwap).toBe(false);
    expect(model.canManageAssets).toBe(false);
    expect(model.canFundWithFriendbot).toBe(false);
  });

  it('does not offer Friendbot when the Network capability does not mark it available', () => {
    const inactive: HomeBalanceState = {
      kind: 'ready',
      stale: false,
      refreshing: false,
      refreshFailed: false,
      snapshot: { status: 'inactive', address: account.address },
    };
    const model = createHomeViewModel(account, false, inactive, {
      swap: false,
      request: false,
      friendbot: false,
    });

    expect(model.canFundWithFriendbot).toBe(false);
  });
});
