import vectors from '../../../../spec/test-vectors/sdex-v1.json';
import { offerLiabilities, preflightOffer, rationalPrice } from '../offerPolicy';
import { stroops } from '../../stellar/classicAmounts';
import { state, native, usd, address } from '@platform/stellar/__tests__/marketFixtures';
const ledger = { baseFeeStroops: 100, baseReserveStroops: 5000000 };
describe('Fresnica SDEX exact price and liability rules', () => {
  it.each(vectors.price_rationalization)('$name', row => expect(rationalPrice(row.requested)).toEqual(row.expected));
  it.each(vectors.offer_liabilities)('$name', row => {
    expect(offerLiabilities(row.side as 'buy' | 'sell', row.amount, row.price_r)).toEqual({
      selling: stroops(row.expected.selling),
      buying: stroops(row.expected.buying),
    });
  });
  it('requires potential entry reserve even when a tiny offer has zero effective liabilities', () => {
    const account = {
      ...state,
      subentryCount: 0,
      balances: state.balances.map(line => (line.kind === 'native' ? { ...line, balance: '1.00001' } : line)),
    };
    expect(() =>
      preflightOffer(
        account,
        { type: 'sell', selling: native, buying: usd, amount: '0.0000001', price: { n: 1, d: 2 }, offerId: '0' },
        ledger,
      ),
    ).toThrow('insufficient_fee');
  });
  it('replacement releases old liabilities before fee and replacement checks', () => {
    const account = {
      ...state,
      subentryCount: 0,
      balances: state.balances.map(line =>
        line.kind === 'native'
          ? { ...line, balance: '11', sellingLiabilities: '10' }
          : line.kind === 'credit'
            ? { ...line, buyingLiabilities: '5' }
            : line,
      ),
    };
    const old = { id: '12', seller: address, selling: native, buying: usd, amount: '10', price: { n: 1, d: 2 } };
    expect(() =>
      preflightOffer(
        account,
        { type: 'sell', selling: native, buying: usd, amount: '9', price: { n: 1, d: 2 }, offerId: '12' },
        ledger,
        old,
      ),
    ).not.toThrow();
  });
  it('allows cancel with revoked authorization while blocking new orders', () => {
    const account = {
      ...state,
      balances: state.balances.map(line => (line.kind === 'credit' ? { ...line, isAuthorized: false } : line)),
    };
    const op = {
      type: 'sell' as const,
      selling: native,
      buying: usd,
      amount: '0',
      price: { n: 1, d: 2 },
      offerId: '12',
    };
    expect(() => preflightOffer(account, op, ledger)).not.toThrow();
    expect(() => preflightOffer(account, { ...op, amount: '1' }, ledger)).toThrow('not_authorized');
  });
});
