import { projectNativeBalanceBreakdown } from '../../../capabilities/balance/nativeBalanceBreakdown';
import { matchingNativeBalance } from '../useNativeBalanceBreakdown';

describe('XLM display details freshness', () => {
  it('only uses verified available balance matching the current account balance', () => {
    const breakdown = projectNativeBalanceBreakdown(
      {
        address: 'GACCOUNT',
        subentryCount: 0,
        numSponsoring: 0,
        numSponsored: 0,
        flags: { authRequired: false, authClawbackEnabled: false },
        balances: [{ kind: 'native', balance: '10.0000000', sellingLiabilities: '0' }],
      },
      { baseReserveStroops: 5000000, baseFeeStroops: 100 },
    );
    expect(matchingNativeBalance(breakdown, '10.0', false)).toBe(breakdown);
    expect(matchingNativeBalance(breakdown, '10.0000000', true)).toBeUndefined();
    expect(matchingNativeBalance(breakdown, '9.9999999', false)).toBeUndefined();
    expect(matchingNativeBalance(breakdown, 'garbage', false)).toBeUndefined();
    expect(matchingNativeBalance(undefined, '10.0', false)).toBeUndefined();
  });
});
