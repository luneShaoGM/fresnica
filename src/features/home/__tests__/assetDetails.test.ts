import type { BalanceSnapshot } from '../../../capabilities/balance/types';
import { canRemoveIssuedBalance, canSendBalance, resolveAssetDetailsSnapshot, sameBalanceAsset } from '../assetDetails';

const issuer = 'GISSUER';
const activeSnapshot: BalanceSnapshot = {
  status: 'active',
  address: 'GACCOUNT',
  balances: [
    { asset: { kind: 'native', code: 'XLM' }, balance: '12.0000000' },
    { asset: { kind: 'credit', code: 'USD', issuer }, balance: '3.5000000' },
  ],
  hiddenLiquidityPoolShareCount: 0,
};

describe('asset details state', () => {
  it('matches native and issued assets by stable domain identity', () => {
    expect(sameBalanceAsset({ kind: 'native', code: 'XLM' }, { kind: 'native', code: 'XLM' })).toBe(true);
    expect(sameBalanceAsset({ kind: 'credit', code: 'USD', issuer }, { kind: 'credit', code: 'USD', issuer })).toBe(
      true,
    );
  });

  it('preserves issued-asset code case when matching identity', () => {
    expect(sameBalanceAsset({ kind: 'credit', code: 'USD', issuer }, { kind: 'credit', code: 'usd', issuer })).toBe(
      false,
    );
  });

  it('projects active, missing and inactive snapshots without carrying stale balances', () => {
    expect(resolveAssetDetailsSnapshot(activeSnapshot, { kind: 'native', code: 'XLM' })).toMatchObject({
      kind: 'ready',
      line: { balance: '12.0000000' },
    });
    expect(resolveAssetDetailsSnapshot(activeSnapshot, { kind: 'credit', code: 'EUR', issuer })).toEqual({
      kind: 'missing',
    });
    expect(
      resolveAssetDetailsSnapshot({ status: 'inactive', address: 'GACCOUNT' }, { kind: 'native', code: 'XLM' }),
    ).toEqual({ kind: 'inactive' });
  });
});

describe('asset action display gates', () => {
  it.each(['0', '0.0000000'])('allows exact zero removal: %s', value => {
    expect(canRemoveIssuedBalance(value)).toBe(true);
    expect(canSendBalance(value)).toBe(false);
  });
  it.each(['0.0000001', '0.00009', '1', '9007199254740993.0000001'])('rejects any nonzero removal: %s', value => {
    expect(canRemoveIssuedBalance(value)).toBe(false);
    expect(canSendBalance(value)).toBe(true);
  });
  it.each(['-1', 'NaN', '1e3', '', '0.00000001'])('fails closed on invalid amounts: %s', value => {
    expect(canRemoveIssuedBalance(value)).toBe(false);
    expect(canSendBalance(value)).toBe(false);
  });
});
