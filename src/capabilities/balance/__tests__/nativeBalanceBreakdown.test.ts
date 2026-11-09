import type { StellarAccountState, StellarLedgerParameters } from '../../stellar/types';
import { loadNativeBalanceBreakdown, projectNativeBalanceBreakdown } from '../nativeBalanceBreakdown';

const address = 'GACCOUNT';
const account: StellarAccountState = {
  address,
  subentryCount: 4,
  numSponsoring: 1,
  numSponsored: 2,
  flags: { authRequired: false, authClawbackEnabled: false },
  balances: [
    { kind: 'native', balance: '10.0000000', sellingLiabilities: '0.2500000' },
    {
      kind: 'credit',
      balance: '5.0000000',
      code: 'USD',
      issuer: 'GISSUER',
      sellingLiabilities: '1',
      buyingLiabilities: '0',
      isAuthorized: true,
      isAuthorizedToMaintainLiabilities: true,
      isClawbackEnabled: false,
    },
  ],
};
const ledger: StellarLedgerParameters = { baseFeeStroops: 100, baseReserveStroops: 5_000_000 };

describe('S05 read-only XLM reserve accounting', () => {
  it('computes exact available, total reserve, sponsored offsets and liabilities', () => {
    const result = projectNativeBalanceBreakdown(account, ledger);
    expect(result).toMatchObject({
      total: '10.0000000',
      available: '7.2500000',
      reserved: '2.5000000',
      accountMinimum: '1.0000000',
      grossEntryReserve: '2.5000000',
      sponsorshipOffset: '1.0000000',
      sellingLiabilities: '0.2500000',
      subentryCount: 4,
      numSponsoring: 1,
      numSponsored: 2,
    });
    expect(result.trustlines).toEqual([{ code: 'USD', issuer: 'GISSUER', authorized: true }]);
  });

  it('handles sponsored account entries and zero available without negative invented balances', () => {
    const result = projectNativeBalanceBreakdown(
      {
        ...account,
        subentryCount: 0,
        numSponsoring: 0,
        numSponsored: 2,
        balances: [{ kind: 'native', balance: '0.1000000', sellingLiabilities: '0.1000000' }],
      },
      ledger,
    );
    expect(result.reserved).toBe('0.0000000');
    expect(result.available).toBe('0.0000000');
    expect(result.sponsorshipOffset).toBe('1.0000000');
    expect(result.trustlines).toEqual([]);
  });

  it('preserves 7 decimal places even above JS safe integer range', () => {
    const result = projectNativeBalanceBreakdown(
      {
        ...account,
        balances: [{ kind: 'native', balance: '9007199254740993.0000001', sellingLiabilities: '0.0000001' }],
      },
      ledger,
    );
    expect(result.available).toBe('9007199254740990.5000000');
  });

  it.each(['NaN', '-1', '1e4', '0.12345678', ''])('fails closed on malformed ledger amounts: %s', value => {
    expect(() =>
      projectNativeBalanceBreakdown(
        {
          ...account,
          balances: [{ kind: 'native', balance: value, sellingLiabilities: '0' }],
        },
        ledger,
      ),
    ).toThrow();
  });

  it('rejects missing native asset, invalid reserve, malformed sponsor counts', () => {
    expect(() => projectNativeBalanceBreakdown({ ...account, balances: [] }, ledger)).toThrow();
    expect(() => projectNativeBalanceBreakdown(account, { ...ledger, baseReserveStroops: -1 })).toThrow();
    expect(() => projectNativeBalanceBreakdown({ ...account, numSponsored: -1 }, ledger)).toThrow();
  });

  it('reads only a correctly partitioned account and no cached or different network totals', async () => {
    const loadAccountState = jest.fn(async () => ({ status: 'active' as const, account }));
    const loadLedgerParameters = jest.fn(async () => ledger);
    const reader = { networkId: 'stellar-mainnet', loadAccountState, loadLedgerParameters };
    const accountRecord = { address, networkId: 'stellar-mainnet', identityKind: 'classic' as const };
    expect((await loadNativeBalanceBreakdown(reader, accountRecord)).available).toBe('7.2500000');
    expect(loadAccountState).toHaveBeenCalledWith(address);
    await expect(
      loadNativeBalanceBreakdown(reader, { ...accountRecord, networkId: 'stellar-testnet' }),
    ).rejects.toThrow('native-breakdown-network-mismatch');
    expect(loadAccountState).toHaveBeenCalledTimes(1);
    await expect(
      loadNativeBalanceBreakdown(
        {
          ...reader,
          loadAccountState: jest.fn(async () => ({
            status: 'active' as const,
            account: { ...account, address: 'OTHER' },
          })),
        },
        accountRecord,
      ),
    ).rejects.toThrow('native-breakdown-account-mismatch');
  });

  it('rejects inactive responses and never invents an activated XLM balance', async () => {
    await expect(
      loadNativeBalanceBreakdown(
        {
          networkId: 'stellar-mainnet',
          loadAccountState: async () => ({ status: 'inactive', address }),
          loadLedgerParameters: async () => ledger,
        },
        { address, networkId: 'stellar-mainnet', identityKind: 'classic' },
      ),
    ).rejects.toThrow('native-breakdown-account-mismatch');
  });
});
