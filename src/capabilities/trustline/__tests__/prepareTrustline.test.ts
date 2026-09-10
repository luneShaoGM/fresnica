import type { AccountRecord } from '../../account/types';
import type { NetworkContext } from '../../network/types';
import type { StellarAccountState } from '../../stellar/types';
import type { TrustlineGatewayPort } from '../TrustlineGateway';
import { DEFAULT_TRUSTLINE_LIMIT, prepareTrustline, revalidateTrustlineReview } from '../prepareTrustline';

const TEST_NETWORK: NetworkContext = Object.freeze({
  id: 'stellar-testnet',
  networkPassphrase: 'Test SDF Network ; September 2015',
});
const sourceAddress = 'GSOURCE';
const issuerAddress = 'GISSUER';

function isClassicAddress(address: string): boolean {
  return address.startsWith('G');
}

function account(): AccountRecord {
  const now = new Date('2026-08-31T00:00:00.000Z');
  return {
    id: 'account-a',
    address: sourceAddress,
    identityKind: 'classic',
    networkId: TEST_NETWORK.id,
    label: 'Primary',
    sortOrder: 0,
    hidden: false,
    createdAt: now,
    updatedAt: now,
  };
}

function sourceState(options?: {
  trustlineBalance?: string;
  buyingLiabilities?: string;
  sellingLiabilities?: string;
  includePool?: boolean;
  nativeBalance?: string;
}): StellarAccountState {
  return {
    address: sourceAddress,
    subentryCount: options?.trustlineBalance === undefined ? 0 : 1,
    numSponsoring: 0,
    numSponsored: 0,
    flags: { authRequired: false, authClawbackEnabled: false },
    balances: [
      {
        kind: 'native',
        balance: options?.nativeBalance ?? '10.0000000',
        sellingLiabilities: '0',
      },
      ...(options?.trustlineBalance === undefined
        ? []
        : [
            {
              kind: 'credit' as const,
              balance: options.trustlineBalance,
              buyingLiabilities: options.buyingLiabilities ?? '0',
              sellingLiabilities: options.sellingLiabilities ?? '0',
              code: 'USD',
              issuer: issuerAddress,
              isAuthorized: true,
              isAuthorizedToMaintainLiabilities: false,
              isClawbackEnabled: false,
            },
          ]),
      ...(options?.includePool
        ? [
            {
              kind: 'liquidity-pool-share' as const,
              balance: '1.0000000',
              liquidityPoolId: 'pool-id',
            },
          ]
        : []),
    ],
  };
}

function issuerState(options?: { authRequired?: boolean; clawback?: boolean }): StellarAccountState {
  return {
    address: issuerAddress,
    subentryCount: 0,
    numSponsoring: 0,
    numSponsored: 0,
    flags: {
      authRequired: options?.authRequired ?? false,
      authClawbackEnabled: options?.clawback ?? false,
    },
    balances: [],
  };
}

function gateway(
  source: StellarAccountState,
  issuer: StellarAccountState = issuerState(),
): jest.Mocked<TrustlineGatewayPort> {
  let lastBuild: Parameters<TrustlineGatewayPort['buildChangeTrust']>[0] | undefined;
  return {
    isClassicAccountAddress: jest.fn(isClassicAddress),
    loadAccountAuthorization: jest.fn(),
    loadAccountState: jest.fn<
      ReturnType<TrustlineGatewayPort['loadAccountState']>,
      Parameters<TrustlineGatewayPort['loadAccountState']>
    >(async address => {
      if (address === sourceAddress) {
        return { status: 'active', account: source };
      }
      if (address === issuerAddress) {
        return { status: 'active', account: issuer };
      }
      return { status: 'inactive', address };
    }),
    loadLedgerParameters: jest.fn().mockResolvedValue({
      baseFeeStroops: 100,
      baseReserveStroops: 5_000_000,
    }),
    loadLiquidityPool: jest.fn().mockResolvedValue({
      id: 'pool-id',
      reserveAssets: ['native'],
    }),
    buildChangeTrust: jest.fn(async input => {
      lastBuild = input;
      return {
        source: input.source,
        networkId: TEST_NETWORK.id,
        transactionXdrBase64: 'change-trust-xdr',
      };
    }),
    inspectTrustlineTransaction: jest.fn<
      ReturnType<TrustlineGatewayPort['inspectTrustlineTransaction']>,
      Parameters<TrustlineGatewayPort['inspectTrustlineTransaction']>
    >(() => {
      if (!lastBuild) {
        throw new Error('test-trustline-not-built');
      }
      return {
        source: lastBuild.source,
        fee: lastBuild.baseFee,
        asset: { code: lastBuild.code, issuer: lastBuild.issuer },
        ...(lastBuild.limit === '0' ? {} : { limit: canonicalLimit(lastBuild.limit) }),
      };
    }),
    transactionHash: jest.fn(),
    loadTransactionOutcome: jest.fn(),
    submitTransaction: jest.fn(),
  };
}

function canonicalLimit(value: string): string {
  const [whole, fraction = ''] = value.split('.');
  return `${whole}.${fraction.padEnd(7, '0')}`;
}

function dependencies(stellar: TrustlineGatewayPort) {
  return { gateway: stellar, network: TEST_NETWORK } as const;
}

describe('prepareTrustline', () => {
  it('uses the normative Fresnica canonical limit and issuer-derived initial state', async () => {
    const stellar = gateway(sourceState(), issuerState({ authRequired: true, clawback: true }));

    const review = await prepareTrustline(dependencies(stellar), account(), {
      action: 'add',
      asset: { code: 'USD', issuer: issuerAddress },
    });

    expect(stellar.buildChangeTrust).toHaveBeenCalledWith({
      source: sourceAddress,
      code: 'USD',
      issuer: issuerAddress,
      limit: DEFAULT_TRUSTLINE_LIMIT,
      baseFee: '100',
    });
    expect(review.operation).toBe('add');
    expect(review.expectedAuthorization).toBe('unauthorized');
    expect(review.expectedClawbackEnabled).toBe(true);
  });

  it('rejects add when the trustline already exists', async () => {
    await expect(
      prepareTrustline(dependencies(gateway(sourceState({ trustlineBalance: '0' }))), account(), {
        action: 'add',
        asset: { code: 'USD', issuer: issuerAddress },
      }),
    ).rejects.toThrow('trustline-already-exists');
  });

  it('requires the issuer to exist for add', async () => {
    const stellar = gateway(sourceState());
    stellar.loadAccountState.mockImplementation(async address =>
      address === sourceAddress ? { status: 'active', account: sourceState() } : { status: 'inactive', address },
    );

    await expect(
      prepareTrustline(dependencies(stellar), account(), {
        action: 'add',
        asset: { code: 'USD', issuer: issuerAddress },
      }),
    ).rejects.toThrow('trustline-issuer-account-inactive');
  });

  it('preflights the additional reserve and fee before add', async () => {
    await expect(
      prepareTrustline(dependencies(gateway(sourceState({ nativeBalance: '1.0000000' }))), account(), {
        action: 'add',
        asset: { code: 'USD', issuer: issuerAddress },
      }),
    ).rejects.toThrow('trustline-insufficient-xlm-for-reserve-and-fee');
  });

  it('sets a positive limit on an existing trustline and preserves current authorization state', async () => {
    const stellar = gateway(sourceState({ trustlineBalance: '2.0000000', buyingLiabilities: '1.0000000' }));

    const review = await prepareTrustline(dependencies(stellar), account(), {
      action: 'set-limit',
      asset: { code: 'USD', issuer: issuerAddress },
      limit: '4.0000000',
    });

    expect(stellar.buildChangeTrust).toHaveBeenCalledWith({
      source: sourceAddress,
      code: 'USD',
      issuer: issuerAddress,
      limit: '4.0000000',
      baseFee: '100',
    });
    expect(review).toMatchObject({
      operation: 'set-limit',
      limit: '4.0000000',
      expectedAuthorization: 'full',
      expectedClawbackEnabled: false,
    });
  });

  it('rejects set-limit without an existing trustline or below balance plus buying liabilities', async () => {
    await expect(
      prepareTrustline(dependencies(gateway(sourceState())), account(), {
        action: 'set-limit',
        asset: { code: 'USD', issuer: issuerAddress },
        limit: '4.0000000',
      }),
    ).rejects.toThrow('trustline-not-found');

    await expect(
      prepareTrustline(
        dependencies(gateway(sourceState({ trustlineBalance: '2.0000000', buyingLiabilities: '1.0000000' }))),
        account(),
        {
          action: 'set-limit',
          asset: { code: 'USD', issuer: issuerAddress },
          limit: '2.9999999',
        },
      ),
    ).rejects.toThrow('trustline-limit-below-commitment');
  });

  it('requires the issuer to still exist for a nonzero set-limit result', async () => {
    const source = sourceState({ trustlineBalance: '0' });
    const stellar = gateway(source);
    stellar.loadAccountState.mockImplementation(async address =>
      address === sourceAddress ? { status: 'active', account: source } : { status: 'inactive', address },
    );

    await expect(
      prepareTrustline(dependencies(stellar), account(), {
        action: 'set-limit',
        asset: { code: 'USD', issuer: issuerAddress },
        limit: '5.0000000',
      }),
    ).rejects.toThrow('trustline-issuer-account-inactive');
  });

  it('revalidates prepared set-limit intent against current ledger state before signing', async () => {
    const initial = sourceState({ trustlineBalance: '0' });
    const stellar = gateway(initial);
    const review = await prepareTrustline(dependencies(stellar), account(), {
      action: 'set-limit',
      asset: { code: 'USD', issuer: issuerAddress },
      limit: '5.0000000',
    });

    stellar.loadAccountState.mockImplementation(async address => {
      if (address === sourceAddress) {
        return { status: 'active', account: sourceState() };
      }
      if (address === issuerAddress) {
        return { status: 'active', account: issuerState() };
      }
      return { status: 'inactive', address };
    });

    await expect(revalidateTrustlineReview(dependencies(stellar), account(), review)).rejects.toThrow(
      'trustline-not-found',
    );
  });

  it('rejects remove while balance or liabilities are non-zero', async () => {
    for (const state of [
      sourceState({ trustlineBalance: '0.0000001' }),
      sourceState({ trustlineBalance: '0', buyingLiabilities: '0.0000001' }),
      sourceState({ trustlineBalance: '0', sellingLiabilities: '0.0000001' }),
    ]) {
      await expect(
        prepareTrustline(dependencies(gateway(state)), account(), {
          action: 'remove',
          asset: { code: 'USD', issuer: issuerAddress },
        }),
      ).rejects.toThrow('trustline-remove-nonzero-balance-or-liabilities');
    }
  });

  it('rejects remove while a held liquidity pool references the asset', async () => {
    const stellar = gateway(sourceState({ trustlineBalance: '0', includePool: true }));
    stellar.loadLiquidityPool.mockResolvedValue({
      id: 'pool-id',
      reserveAssets: [`USD:${issuerAddress}`, 'native'],
    });

    await expect(
      prepareTrustline(dependencies(stellar), account(), {
        action: 'remove',
        asset: { code: 'USD', issuer: issuerAddress },
      }),
    ).rejects.toThrow('trustline-remove-used-by-liquidity-pool');
  });

  it('allows removal without requiring the issuer account to still exist', async () => {
    const stellar = gateway(sourceState({ trustlineBalance: '0' }));

    const review = await prepareTrustline(dependencies(stellar), account(), {
      action: 'remove',
      asset: { code: 'USD', issuer: issuerAddress },
    });

    expect(review.operation).toBe('remove');
    expect(stellar.loadAccountState).toHaveBeenCalledTimes(1);
    expect(stellar.buildChangeTrust).toHaveBeenCalledWith(expect.objectContaining({ limit: '0' }));
  });

  it('rejects invalid identity and issuer self-trust cases', async () => {
    await expect(
      prepareTrustline(dependencies(gateway(sourceState())), account(), {
        action: 'add',
        asset: { code: 'USD!', issuer: issuerAddress },
      }),
    ).rejects.toThrow('invalid-trustline-asset-code');

    await expect(
      prepareTrustline(dependencies(gateway(sourceState())), account(), {
        action: 'add',
        asset: { code: 'USD', issuer: sourceAddress },
      }),
    ).rejects.toThrow('trustline-issuer-cannot-trust-own-asset');
  });
});
