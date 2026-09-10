import type {NetworkContext} from '../../network/types';
import type {PaymentGatewayPort} from '../PaymentGateway';
import {buildPaymentReview} from '../buildPaymentReview';

const TEST_NETWORK: NetworkContext = Object.freeze({
  id: 'stellar-testnet',
  networkPassphrase: 'Test SDF Network ; September 2015',
});

function gateway(): Pick<PaymentGatewayPort, 'inspectPaymentTransaction'> {
  return {
    inspectPaymentTransaction: jest.fn().mockReturnValue({
      source: 'GSOURCE',
      fee: '100',
      expiresAtUnixSeconds: 1_800_000_000,
      operation: 'payment',
      destination: 'GDESTINATION',
      amount: '2.5000000',
      asset: {kind: 'credit', code: 'usd', issuer: 'GISSUER'},
      memo: 'review-me',
    }),
  };
}

function dependencies(stellar = gateway()) {
  return {gateway: stellar, network: TEST_NETWORK} as const;
}
describe('buildPaymentReview', () => {
  it('binds the platform projection to the exact XDR and network context', () => {
    const stellar = gateway();
    const review = buildPaymentReview(dependencies(stellar), {
      transactionXdrBase64: 'exact-xdr',
      networkId: TEST_NETWORK.id,
    });

    expect(stellar.inspectPaymentTransaction).toHaveBeenCalledWith({
      transactionXdrBase64: 'exact-xdr',
      networkPassphrase: TEST_NETWORK.networkPassphrase,
    });
    expect(review).toEqual({
      transactionXdrBase64: 'exact-xdr',
      networkId: TEST_NETWORK.id,
      source: 'GSOURCE',
      fee: '100',
      expiresAtUnixSeconds: 1_800_000_000,
      operation: 'payment',
      destination: 'GDESTINATION',
      amount: '2.5000000',
      asset: {kind: 'credit', code: 'usd', issuer: 'GISSUER'},
      memo: 'review-me',
    });
  });
  it('freezes review and nested asset data', () => {
    const review = buildPaymentReview(dependencies(), {
      transactionXdrBase64: 'exact-xdr',
      networkId: TEST_NETWORK.id,
    });

    expect(Object.isFrozen(review)).toBe(true);
    expect(Object.isFrozen(review.asset)).toBe(true);
  });

  it('rejects a network mismatch before asking the platform to inspect XDR', () => {
    const stellar = gateway();

    expect(() =>
      buildPaymentReview(dependencies(stellar), {
        transactionXdrBase64: 'exact-xdr',
        networkId: 'stellar-mainnet',
      }),
    ).toThrow('Payment review network mismatch');
    expect(stellar.inspectPaymentTransaction).not.toHaveBeenCalled();
  });
});
