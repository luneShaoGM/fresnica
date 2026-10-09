import type { AccountRecord } from '../../../capabilities/account/types';
import type { BalanceLine } from '../../../capabilities/balance/types';
import type { RequestPaymentIntent } from '../../../capabilities/request/requestUri';
import { resolveRequestSendPrefill } from '../requestSendPrefill';

const network = Object.freeze({ id: 'stellar-testnet', networkPassphrase: 'Test SDF Network ; September 2015' });
const issuer = 'GISSUER';
const nativeBalance: BalanceLine = Object.freeze({ asset: { kind: 'native', code: 'XLM' }, balance: '10' });
const creditBalance: BalanceLine = Object.freeze({ asset: { kind: 'credit', code: 'USD', issuer }, balance: '4' });
const balances = [nativeBalance, creditBalance];

function account(overrides: Partial<AccountRecord> = {}): AccountRecord {
  const now = new Date('2026-10-09T00:00:00.000Z');
  return {
    id: 'source',
    address: 'GSOURCE',
    identityKind: 'classic',
    networkId: network.id,
    label: 'Current wallet',
    sortOrder: 0,
    hidden: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function intent(overrides: Partial<RequestPaymentIntent> = {}): RequestPaymentIntent {
  return {
    syntax: 'sep7-pay',
    destination: 'GDESTINATION',
    asset: { kind: 'native' },
    networkId: network.id,
    networkPassphrase: network.networkPassphrase,
    ...overrides,
  };
}

describe('Request into Send prefill', () => {
  it('fills XLM and preserves the exact amount without inventing a memo', () => {
    expect(resolveRequestSendPrefill(intent({ amount: '12.3456789' }), account(), network, balances, false)).toEqual({
      kind: 'ready',
      destination: 'GDESTINATION',
      amount: '12.3456789',
      asset: nativeBalance.asset,
      memoType: 'none',
      memoValue: '',
    });
  });

  it('leaves an open amount blank', () => {
    expect(resolveRequestSendPrefill(intent({ syntax: 'address' }), account(), network, balances, false)).toMatchObject({
      kind: 'ready',
      amount: '',
      memoType: 'none',
      memoValue: '',
    });
  });

  it.each([
    ['text', ' memo text '],
    ['id', '42'],
    ['hash', 'ab'.repeat(32)],
  ] as const)('preserves %s memo but never promotes the public message to transaction memo', (type, value) => {
    const result = resolveRequestSendPrefill(
      intent({ memo: { type, value }, message: 'Public untrusted request context' }),
      account(),
      network,
      balances,
      false,
    );
    expect(result).toMatchObject({ kind: 'ready', memoType: type, memoValue: value });
    expect(result).not.toHaveProperty('message');
  });

  it('selects an issued asset only by exact code and issuer', () => {
    const requested = intent({ asset: { kind: 'credit', code: 'USD', issuer } });
    expect(resolveRequestSendPrefill(requested, account(), network, balances, false)).toMatchObject({
      kind: 'ready',
      asset: { kind: 'credit', code: 'USD', issuer },
    });
    expect(
      resolveRequestSendPrefill(
        intent({ asset: { kind: 'credit', code: 'USD', issuer: 'GWRONGISSUER' } }),
        account(),
        network,
        balances,
        false,
      ),
    ).toEqual({ kind: 'blocked', reason: 'asset-unavailable' });
  });

  it('does not substitute XLM when the requested asset is unavailable', () => {
    const requested = intent({ asset: { kind: 'credit', code: 'USD', issuer } });
    expect(resolveRequestSendPrefill(requested, account(), network, [nativeBalance], false)).toEqual({
      kind: 'blocked',
      reason: 'asset-unavailable',
    });
  });

  it('fails closed on hidden, watch-only, wrong-network and non-Classic source accounts', () => {
    const request = intent();
    expect(resolveRequestSendPrefill(request, account({ hidden: true }), network, balances, false)).toMatchObject({ kind: 'blocked' });
    expect(resolveRequestSendPrefill(request, account(), network, balances, true)).toMatchObject({ kind: 'blocked' });
    expect(resolveRequestSendPrefill(request, account({ networkId: 'other' }), network, balances, false)).toMatchObject({ kind: 'blocked' });
    expect(resolveRequestSendPrefill(intent({ networkPassphrase: 'other' }), account(), network, balances, false)).toMatchObject({ kind: 'blocked' });
    expect(resolveRequestSendPrefill(request, account({ identityKind: 'contract' }), network, balances, false)).toMatchObject({ kind: 'blocked' });
  });
});
