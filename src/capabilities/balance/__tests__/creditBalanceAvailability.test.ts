import { projectCreditBalanceAvailability } from '../creditBalanceAvailability';
import type { BalanceLine } from '../types';

function credit(overrides: Partial<BalanceLine> = {}): BalanceLine {
  return {
    asset: { kind: 'credit', code: 'USD', issuer: 'GISSUER' },
    balance: '10.0000001',
    limit: '20.0000000',
    buyingLiabilities: '3.0000000',
    sellingLiabilities: '2.0000000',
    isAuthorized: true,
    isAuthorizedToMaintainLiabilities: false,
    isClawbackEnabled: false,
    ...overrides,
  };
}

describe('credit balance display availability', () => {
  it('subtracts selling and buying liabilities from their respective exact amounts', () => {
    expect(projectCreditBalanceAvailability(credit())).toEqual({
      balance: '10.0000001',
      available: '8.0000001',
      receivingCapacity: '6.9999999',
      buyingLiabilities: '3.0000000',
      sellingLiabilities: '2.0000000',
      authorization: 'authorized',
      clawbackEnabled: false,
      canSend: true,
      canRemove: false,
      removeBlockedReason: 'balance-not-zero',
    });
  });

  it('retains one stroop near the signed 64-bit amount maximum without Number rounding', () => {
    expect(projectCreditBalanceAvailability(credit({
      balance: '922337203685.4775806',
      sellingLiabilities: '922337203685.4775805',
      buyingLiabilities: '0',
      limit: '922337203685.4775807',
    }))).toMatchObject({ available: '0.0000001', receivingCapacity: '0.0000001', canSend: true });
  });

  it('clamps exhausted spendable balance and receiving capacity to zero', () => {
    expect(projectCreditBalanceAvailability(credit({ balance: '1', limit: '2' }))).toMatchObject({
      available: '0.0000000',
      receivingCapacity: '0.0000000',
      canSend: false,
      sendBlockedReason: 'no-available-balance',
    });
  });

  it('keeps absent old-cache facts unknown instead of granting authorization or assuming zero liabilities', () => {
    const old = { asset: credit().asset, balance: '0', limit: '100' };
    expect(projectCreditBalanceAvailability(old)).toEqual({
      balance: '0.0000000', authorization: 'unknown',
      canSend: false, sendBlockedReason: 'unknown',
      canRemove: false, removeBlockedReason: 'unknown',
    });
  });

  it('keeps unrelated missing facts independent rather than discarding known spendable information', () => {
    const result = projectCreditBalanceAvailability(credit({ buyingLiabilities: undefined, limit: undefined }));
    expect(result).toMatchObject({ available: '8.0000001', canSend: true });
    expect(result.receivingCapacity).toBeUndefined();
    expect(result.buyingLiabilities).toBeUndefined();
  });

  it.each([
    [true, false, 'authorized', true, undefined],
    [true, true, 'authorized', true, undefined],
    [false, true, 'maintain-liabilities', false, 'maintain-liabilities'],
    [false, false, 'unauthorized', false, 'unauthorized'],
    [false, undefined, 'unauthorized', false, 'unauthorized'],
    [undefined, true, 'unknown', false, 'unknown'],
    [undefined, false, 'unknown', false, 'unknown'],
  ] as const)('maps authorization %s / maintain %s without treating maintain-only as a payment grant', (isAuthorized, maintain, authorization, canSend, reason) => {
    expect(projectCreditBalanceAvailability(credit({ isAuthorized, isAuthorizedToMaintainLiabilities: maintain })))
      .toMatchObject({ authorization, canSend });
    expect(projectCreditBalanceAvailability(credit({ isAuthorized, isAuthorizedToMaintainLiabilities: maintain })).sendBlockedReason)
      .toBe(reason);
  });

  it.each([true, false, undefined])('does not equate clawback=%s with frozen or unauthorized', isClawbackEnabled => {
    const result = projectCreditBalanceAvailability(credit({ isClawbackEnabled }));
    expect(result.canSend).toBe(true);
    expect(result.authorization).toBe('authorized');
    expect(result.clawbackEnabled).toBe(isClawbackEnabled);
  });

  it('allows removal only with exact zero balance and both zero liabilities, independent of authorization', () => {
    expect(projectCreditBalanceAvailability(credit({
      balance: '0', sellingLiabilities: '0.0000000', buyingLiabilities: '0', isAuthorized: false,
    }))).toMatchObject({ canRemove: true, canSend: false });
  });

  it.each(['buyingLiabilities', 'sellingLiabilities'] as const)('blocks zero-balance removal with nonzero or unknown %s', field => {
    const empty = credit({ balance: '0', sellingLiabilities: '0', buyingLiabilities: '0' });
    expect(projectCreditBalanceAvailability({ ...empty, [field]: '0.0000001' })).toMatchObject({
      canRemove: false, removeBlockedReason: 'liabilities',
    });
    expect(projectCreditBalanceAvailability({ ...empty, [field]: undefined })).toMatchObject({
      canRemove: false, removeBlockedReason: 'unknown',
    });
  });

  it.each(['-1', '1e3', 'NaN', '', '0.00000001', '922337203685.4775808'])('does not fabricate spendable balance from invalid %s', value => {
    const result = projectCreditBalanceAvailability(credit({ sellingLiabilities: value }));
    expect(result.available).toBeUndefined();
    expect(result).toMatchObject({ canSend: false, sendBlockedReason: 'unknown' });
  });
});
