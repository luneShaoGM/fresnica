import type { BalanceSnapshot } from '../../../capabilities/balance/types';
import {
  authoritativeSpendable,
  canRemoveIssuedBalance,
  canSendBalance,
  resolveAssetDetailsSnapshot,
  sameBalanceAsset,
} from '../assetDetails';

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

  it('uses Stellar dust and spendable thresholds without inventing a cached spendable figure', () => {
    expect(canRemoveIssuedBalance('0')).toBe(true);
    expect(canRemoveIssuedBalance('0.0000999')).toBe(true);
    expect(canRemoveIssuedBalance('0.0001')).toBe(false);
    expect(canSendBalance('0.00000001')).toBe(true);
    expect(canSendBalance('0')).toBe(false);
    const asset = { kind: 'native' as const, code: 'XLM' as const };
    expect(authoritativeSpendable([{ asset, balance: '12', spendable: '10' }], undefined, asset)).toBeUndefined();
    expect(authoritativeSpendable([{ asset, balance: '12', spendable: '10' }], 100, asset)).toBe('10');
  });
});
