import type { AccountRecord } from '../../account/types';
import type { FriendbotGatewayPort } from '../FriendbotGateway';
import { fundTestnetAccountWithFriendbot, isFriendbotFundingAvailable } from '../fundTestnetAccountWithFriendbot';

const TESTNET = 'stellar-testnet';

function account(overrides: Partial<AccountRecord> = {}): AccountRecord {
  return {
    id: 'account-1',
    address: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMNO',
    identityKind: 'classic',
    networkId: TESTNET,
    label: 'Primary',
    sortOrder: 0,
    hidden: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function gateway() {
  const fundAccount = jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined);
  return { port: { fundAccount } satisfies FriendbotGatewayPort, fundAccount };
}

describe('isFriendbotFundingAvailable', () => {
  it('offers Friendbot only when the active network and Classic account are Testnet', () => {
    const fake = gateway();

    expect(isFriendbotFundingAvailable({ gateway: fake.port, networkId: TESTNET }, account())).toBe(true);
    expect(
      isFriendbotFundingAvailable(
        { gateway: fake.port, networkId: 'stellar-mainnet' },
        account({ networkId: 'stellar-mainnet' }),
      ),
    ).toBe(false);
    expect(
      isFriendbotFundingAvailable(
        { gateway: fake.port, networkId: TESTNET },
        account({ networkId: 'stellar-mainnet' }),
      ),
    ).toBe(false);
    expect(
      isFriendbotFundingAvailable({ gateway: fake.port, networkId: TESTNET }, account({ identityKind: 'contract' })),
    ).toBe(false);
  });
});

describe('fundTestnetAccountWithFriendbot', () => {
  it('funds the exact public address for a Testnet Classic account', async () => {
    const fake = gateway();
    const current = account();

    await fundTestnetAccountWithFriendbot({ gateway: fake.port, networkId: TESTNET }, current);

    expect(fake.fundAccount).toHaveBeenCalledWith(current.address);
  });

  it('fails closed outside Stellar Testnet', async () => {
    const fake = gateway();

    await expect(
      fundTestnetAccountWithFriendbot(
        { gateway: fake.port, networkId: 'stellar-mainnet' },
        account({ networkId: 'stellar-mainnet' }),
      ),
    ).rejects.toThrow('friendbot-network-not-supported');
    expect(fake.fundAccount).not.toHaveBeenCalled();
  });

  it('rejects an account from a different active network', async () => {
    const fake = gateway();

    await expect(
      fundTestnetAccountWithFriendbot(
        { gateway: fake.port, networkId: TESTNET },
        account({ networkId: 'stellar-mainnet' }),
      ),
    ).rejects.toThrow('friendbot-network-mismatch:stellar-mainnet');
    expect(fake.fundAccount).not.toHaveBeenCalled();
  });

  it('rejects non-Classic identities without calling Friendbot', async () => {
    const fake = gateway();

    await expect(
      fundTestnetAccountWithFriendbot(
        { gateway: fake.port, networkId: TESTNET },
        account({ identityKind: 'contract' }),
      ),
    ).rejects.toThrow('friendbot-account-not-supported');
    expect(fake.fundAccount).not.toHaveBeenCalled();
  });
});
