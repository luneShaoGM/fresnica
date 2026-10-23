import type { StellarAccountState, StellarLedgerParameters } from '../../stellar/types';
import { projectPathPaymentSourceAvailability } from '../sourceAvailability';

const ledger: StellarLedgerParameters = {
  baseFeeStroops: 100,
  baseReserveStroops: 5_000_000,
};

function account(nativeBalance: string): StellarAccountState {
  return {
    address: 'GSOURCE',
    subentryCount: 1,
    numSponsoring: 0,
    numSponsored: 0,
    flags: { authRequired: false, authClawbackEnabled: false },
    balances: [
      {
        kind: 'native',
        balance: nativeBalance,
        sellingLiabilities: '1.0000000',
        buyingLiabilities: '0.0000000',
      },
      {
        kind: 'credit',
        code: 'USDC',
        issuer: 'GISSUER',
        balance: '12.5000000',
        limit: '100.0000000',
        sellingLiabilities: '2.2500000',
        buyingLiabilities: '0.0000000',
        isAuthorized: true,
        isAuthorizedToMaintainLiabilities: true,
        isClawbackEnabled: false,
      },
      {
        kind: 'liquidity-pool-share',
        liquidityPoolId: 'pool',
        balance: '3.0000000',
      },
    ],
  };
}

describe('Path Payment source availability', () => {
  it('projects conservative native reserve/fee and credit selling liabilities without losing asset identity', () => {
    expect(projectPathPaymentSourceAvailability(account('20.0000000'), ledger)).toEqual([
      {
        asset: { kind: 'native' },
        balance: '20.0000000',
        spendable: '17.4999900',
      },
      {
        asset: { kind: 'credit', code: 'USDC', issuer: 'GISSUER' },
        balance: '12.5000000',
        spendable: '10.2500000',
      },
    ]);
  });

  it('clamps unavailable native balance to zero and excludes liquidity-pool shares', () => {
    expect(projectPathPaymentSourceAvailability(account('1.0000000'), ledger)[0]?.spendable).toBe('0.0000000');
    expect(projectPathPaymentSourceAvailability(account('1.0000000'), ledger)).toHaveLength(2);
  });

  it('excludes credit assets that are not fully authorized', () => {
    const state = account('20.0000000');
    const unauthorized: StellarAccountState = {
      ...state,
      balances: state.balances.map(balance =>
        balance.kind === 'credit' ? { ...balance, isAuthorized: false } : balance,
      ),
    };
    expect(projectPathPaymentSourceAvailability(unauthorized, ledger)).toHaveLength(1);
  });
});
