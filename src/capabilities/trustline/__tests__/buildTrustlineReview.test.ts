import type { NetworkContext } from '../../network/types';
import type { TrustlineGatewayPort } from '../TrustlineGateway';
import { buildTrustlineReview } from '../buildTrustlineReview';

const TEST_NETWORK: NetworkContext = Object.freeze({
  id: 'stellar-testnet',
  networkPassphrase: 'Test SDF Network ; September 2015',
});

function gateway(limit: string | null = '708269837873.6765000') {
  return {
    inspectTrustlineTransaction: jest.fn().mockReturnValue({
      source: 'GSOURCE',
      fee: '100',
      expiresAtUnixSeconds: 1_800_000_000,
      asset: { code: 'USD', issuer: 'GISSUER' },
      ...(limit === null ? {} : { limit }),
    }),
  } satisfies Pick<TrustlineGatewayPort, 'inspectTrustlineTransaction'>;
}

function dependencies(stellar = gateway()) {
  return { gateway: stellar, network: TEST_NETWORK } as const;
}
describe('buildTrustlineReview', () => {
  it('binds an add projection to exact XDR and expected issuer state', () => {
    const stellar = gateway();
    const review = buildTrustlineReview(dependencies(stellar), {
      transactionXdrBase64: 'exact-change-trust-xdr',
      networkId: TEST_NETWORK.id,
      expectedAuthorization: 'unauthorized',
      expectedClawbackEnabled: true,
    });

    expect(stellar.inspectTrustlineTransaction).toHaveBeenCalledWith({
      transactionXdrBase64: 'exact-change-trust-xdr',
      networkPassphrase: TEST_NETWORK.networkPassphrase,
    });
    expect(review).toEqual({
      transactionXdrBase64: 'exact-change-trust-xdr',
      networkId: TEST_NETWORK.id,
      source: 'GSOURCE',
      fee: '100',
      expiresAtUnixSeconds: 1_800_000_000,
      operation: 'add',
      asset: { code: 'USD', issuer: 'GISSUER' },
      limit: '708269837873.6765000',
      expectedAuthorization: 'unauthorized',
      expectedClawbackEnabled: true,
    });
  });
  it('preserves explicit set-limit intent for a nonzero ChangeTrust projection', () => {
    const review = buildTrustlineReview(dependencies(gateway('5.0000000')), {
      transactionXdrBase64: 'exact-set-limit-xdr',
      networkId: TEST_NETWORK.id,
      operation: 'set-limit',
    });

    expect(review.operation).toBe('set-limit');
    expect(review.limit).toBe('5.0000000');
  });

  it('rejects intent that contradicts zero/nonzero ChangeTrust XDR semantics', () => {
    expect(() =>
      buildTrustlineReview(dependencies(gateway('5.0000000')), {
        transactionXdrBase64: 'exact-nonzero-xdr',
        networkId: TEST_NETWORK.id,
        operation: 'remove',
      }),
    ).toThrow('trustline-review-operation-xdr-mismatch');
    expect(() =>
      buildTrustlineReview(dependencies(gateway(null)), {
        transactionXdrBase64: 'exact-zero-xdr',
        networkId: TEST_NETWORK.id,
        operation: 'set-limit',
      }),
    ).toThrow('trustline-review-operation-xdr-mismatch');
  });

  it('derives remove semantics when the platform projection has no nonzero limit', () => {
    const review = buildTrustlineReview(dependencies(gateway(null)), {
      transactionXdrBase64: 'exact-remove-xdr',
      networkId: TEST_NETWORK.id,
    });

    expect(review.operation).toBe('remove');
    expect(review.limit).toBeUndefined();
    expect(Object.isFrozen(review)).toBe(true);
    expect(Object.isFrozen(review.asset)).toBe(true);
  });

  it('rejects a network mismatch before asking the platform to inspect XDR', () => {
    const stellar = gateway();

    expect(() =>
      buildTrustlineReview(dependencies(stellar), {
        transactionXdrBase64: 'exact-change-trust-xdr',
        networkId: 'stellar-mainnet',
      }),
    ).toThrow('Trustline review network mismatch');
    expect(stellar.inspectTrustlineTransaction).not.toHaveBeenCalled();
  });
});
