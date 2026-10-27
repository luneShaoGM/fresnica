import { projectPathPaymentSpendable } from '../preflightPathPayment';
import type { StellarAccountState, StellarPaymentAsset } from '../../stellar/types';

const XLM = { kind: 'native' as const };
const USD: StellarPaymentAsset = { kind: 'credit', code: 'USD', issuer: 'GISSUER' };
const ledger = { baseFeeStroops: 100, baseReserveStroops: 5_000_000 };
const source: StellarAccountState = {
  address: 'GSOURCE',
  subentryCount: 2,
  numSponsoring: 1,
  numSponsored: 1,
  flags: { authRequired: false, authClawbackEnabled: false },
  balances: [
    { kind: 'native', balance: '20', sellingLiabilities: '1' },
    {
      kind: 'credit',
      code: 'USD',
      issuer: 'GISSUER',
      balance: '8.0000000',
      limit: '100',
      buyingLiabilities: '0',
      sellingLiabilities: '3.1250000',
      isAuthorized: true,
      isAuthorizedToMaintainLiabilities: true,
      isClawbackEnabled: false,
    },
  ],
};

describe('projectPathPaymentSpendable (display-only, shared with C1 source bounds)', () => {
  it('deducts live sponsored reserve, native liabilities and fee exactly in stroops', () => {
    expect(projectPathPaymentSpendable(source, XLM, ledger, 100)).toBe('16.9999900');
    expect(projectPathPaymentSpendable({ ...source, numSponsored: 0 }, XLM, ledger, 100)).toBe('16.4999900');
    expect(projectPathPaymentSpendable(source, XLM, ledger, 200)).toBe('16.9999800');
  });
  it('deducts credit selling liabilities and requires an authorized trustline and native fee', () => {
    expect(projectPathPaymentSpendable(source, USD, ledger, 100)).toBe('4.8750000');
    const unauthorized = {
      ...source,
      balances: source.balances.map(b => (b.kind === 'credit' ? { ...b, isAuthorized: false } : b)),
    };
    expect(() => projectPathPaymentSpendable(unauthorized, USD, ledger, 100)).toThrow('not_authorized');
    expect(() => projectPathPaymentSpendable(source, { ...USD, issuer: 'GOTHER' }, ledger, 100)).toThrow(
      'insufficient_source',
    );
  });
  it('never fabricates finite Max for an issuer, or a fee-free amount when XLM is insufficient', () => {
    expect(projectPathPaymentSpendable(source, { ...USD, issuer: source.address }, ledger, 100)).toBeUndefined();
    const low = {
      ...source,
      balances: source.balances.map(b => (b.kind === 'native' ? { ...b, balance: '2' } : b)),
    };
    expect(() => projectPathPaymentSpendable(low, USD, ledger, 100)).toThrow('insufficient_source');
    expect(() => projectPathPaymentSpendable(low, XLM, ledger, 100)).toThrow('insufficient_source');
  });
  it('represents exact zero without allowing an invalid positive Max, and rejects malformed ledger values', () => {
    const depleted = {
      ...source,
      balances: source.balances.map(b => (b.kind === 'credit' ? { ...b, balance: b.sellingLiabilities } : b)),
    };
    expect(projectPathPaymentSpendable(depleted, USD, ledger, 100)).toBe('0.0000000');
    expect(() => projectPathPaymentSpendable(source, XLM, { ...ledger, baseReserveStroops: -1 }, 100)).toThrow(
      'quote_unavailable',
    );
    expect(() => projectPathPaymentSpendable(source, XLM, ledger, Number.NaN)).toThrow('quote_unavailable');
  });
});
