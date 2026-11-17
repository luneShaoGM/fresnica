import vectors from '../../../../spec/test-vectors/liquidity-pool-exit-v1.json';
import { exitAmounts, preflightExit } from '../exitPolicy';
import { amount, stroops } from '../../stellar/classicAmounts';
import { exit, pool, state, issuer } from '@platform/stellar/__tests__/marketFixtures';
import type { StellarAccountState } from '../../stellar/types';

const ledger = { baseFeeStroops: 100, baseReserveStroops: 5000000 };
describe('upstream 85d6cdf liquidity-pool-exit-v1', () => {
  it.each(vectors.calculations)('$name', row => {
    const result = exitAmounts(
      { ...pool, reserveA: row.pool.reserve_a, reserveB: row.pool.reserve_b, totalShares: row.pool.total_shares },
      row.owned_shares,
      { ...exit, mode: 'exact_shares', shares: row.withdraw_shares, slippageBps: row.slippage_bps },
    );
    expect(result).toMatchObject({
      expectedA: row.expected.amount_a,
      expectedB: row.expected.amount_b,
      minA: row.expected.min_amount_a,
      minB: row.expected.min_amount_b,
    });
  });
  it.each(vectors.full_exit)('$name', row => {
    const result = exitAmounts(pool, row.owned_shares, {
      ...exit,
      close: row.close_pool_share_trustline,
      slippageBps: row.slippage_bps,
    });
    expect(result.shares).toBe(row.expected.withdraw_shares);
  });
  it('keeps a one-sided zero valid and clamps nonzero minima to one stroop', () => {
    expect(
      exitAmounts({ ...pool, reserveA: '0.0000001', totalShares: '50' }, '5', { ...exit, slippageBps: 1000 }),
    ).toMatchObject({ expectedA: '0.0000000', minA: '0.0000000' });
    expect(() => exitAmounts({ ...pool, reserveA: '0.0000001', reserveB: '0.0000001' }, '5', exit)).toThrow(
      'withdrawal_too_small',
    );
  });
  it('rejects invalid, excess, zero, precision and overflow amounts, partial cleanup and out-of-range slippage', () => {
    for (const shares of ['0', '5.0000001', '-1', '1e2', '0.00000001', '922337203685.4775808'])
      expect(() => exitAmounts(pool, '5', { ...exit, mode: 'exact_shares', shares })).toThrow();
    expect(() => exitAmounts(pool, '5', { ...exit, mode: 'exact_shares', shares: '5', close: true })).toThrow(
      'close_requires_full_exit',
    );
    for (const slippageBps of [-1, 1001, 1.5, NaN])
      expect(() => exitAmounts(pool, '5', { ...exit, slippageBps })).toThrow('slippage_out_of_range');
  });
  it('allows unwind without full ordinary authorization, but requires receiving capacity', () => {
    const balances = state.balances.map(line =>
      line.kind === 'credit' ? { ...line, isAuthorized: false, isAuthorizedToMaintainLiabilities: false } : line,
    );
    expect(preflightExit({ ...state, balances }, pool, exit, ledger).expectedB).toBe('20.0000000');
    expect(() =>
      preflightExit({ ...state, balances: balances.filter(line => line.kind !== 'credit') }, pool, exit, ledger),
    ).toThrow('receiving_trustline_missing');
    expect(() =>
      preflightExit(
        {
          ...state,
          balances: balances.map(line => (line.kind === 'credit' ? { ...line, limit: '1019.9999999' } : line)),
        },
        pool,
        exit,
        ledger,
      ),
    ).toThrow('receiving_capacity_insufficient');
  });
  it('issuer receipt needs no self-trustline; native capacity includes buying liabilities', () => {
    expect(
      preflightExit(
        { ...state, address: issuer, balances: state.balances.filter(line => line.kind !== 'credit') },
        pool,
        exit,
        ledger,
      ),
    ).toBeDefined();
    const fullNative: StellarAccountState = {
      ...state,
      balances: state.balances.map(line =>
        line.kind === 'native' ? { ...line, balance: '922337203685.4775800', buyingLiabilities: '0.0000007' } : line,
      ),
    };
    expect(() => preflightExit(fullNative, pool, exit, ledger)).toThrow('receiving_capacity_insufficient');
  });
  it('cleanup accounts for two operations/subentries and sponsorship', () => {
    expect(preflightExit(state, pool, { ...exit, close: true }, ledger)).toMatchObject({
      fee: '200',
      reserveReleased: '1.0000000',
    });
    const sponsored = {
      ...state,
      balances: state.balances.map(line =>
        line.kind === 'liquidity-pool-share' ? { ...line, sponsor: issuer } : line,
      ),
    };
    expect(preflightExit(sponsored, pool, { ...exit, close: true }, ledger)).toMatchObject({
      fee: '200',
      reserveReleased: '0.0000000',
      sponsor: issuer,
    });
    expect(amount(stroops('922337203685.4775807'))).toBe('922337203685.4775807');
  });
});
