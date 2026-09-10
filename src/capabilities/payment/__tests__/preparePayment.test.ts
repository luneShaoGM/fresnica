import type { AccountRecord } from '../../account/types';
import type { NetworkContext } from '../../network/types';
import type { StellarAccountState } from '../../stellar/types';
import type { PaymentGatewayPort } from '../PaymentGateway';
import {
  preparePayment,
  validateClassicDestination,
  validatePaymentAsset,
  validatePaymentTextMemo,
} from '../preparePayment';

const TEST_NETWORK: NetworkContext = Object.freeze({
  id: 'stellar-testnet',
  networkPassphrase: 'Test SDF Network ; September 2015',
});
const sourceAddress = 'GSOURCE';
const destinationAddress = 'GDESTINATION';
const issuerAddress = 'GISSUER';

function isClassicAddress(address: string): boolean {
  return address.startsWith('G');
}

function account(): AccountRecord {
  const now = new Date('2026-09-01T00:00:00.000Z');
  return {
    id: 'account-payment',
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

function activeAccount(
  address: string,
  options?: {
    native?: string;
    nativeBuying?: string;
    nativeSelling?: string;
    trustline?: {
      code: string;
      issuer: string;
      balance: string;
      limit?: string;
      buying?: string;
      selling?: string;
      authorized?: boolean;
    };
    memoRequired?: boolean;
  },
): StellarAccountState {
  return {
    address,
    subentryCount: options?.trustline ? 1 : 0,
    numSponsoring: 0,
    numSponsored: 0,
    memoRequired: options?.memoRequired ?? false,
    flags: { authRequired: false, authClawbackEnabled: false },
    balances: [
      {
        kind: 'native',
        balance: options?.native ?? '10.0000000',
        buyingLiabilities: options?.nativeBuying ?? '0',
        sellingLiabilities: options?.nativeSelling ?? '0',
      },
      ...(options?.trustline
        ? [
            {
              kind: 'credit' as const,
              balance: options.trustline.balance,
              ...(options.trustline.limit === undefined ? {} : { limit: options.trustline.limit }),
              buyingLiabilities: options.trustline.buying ?? '0',
              sellingLiabilities: options.trustline.selling ?? '0',
              code: options.trustline.code,
              issuer: options.trustline.issuer,
              isAuthorized: options.trustline.authorized ?? true,
              isAuthorizedToMaintainLiabilities: false,
              isClawbackEnabled: false,
            },
          ]
        : []),
    ],
  };
}

function canonicalAmount(value: string): string {
  const [whole, fraction = ''] = value.split('.');
  return `${whole}.${fraction.padEnd(7, '0')}`;
}

function gateway(options?: {
  source?: StellarAccountState;
  destination?: StellarAccountState | 'inactive';
}): jest.Mocked<PaymentGatewayPort> {
  const source = options?.source ?? activeAccount(sourceAddress);
  const destination = options?.destination ?? activeAccount(destinationAddress);
  let lastBuild: Parameters<PaymentGatewayPort['buildPayment']>[0] | undefined;

  return {
    isClassicAccountAddress: jest.fn(isClassicAddress),
    loadAccountAuthorization: jest.fn(),
    loadAccountState: jest.fn<
      ReturnType<PaymentGatewayPort['loadAccountState']>,
      Parameters<PaymentGatewayPort['loadAccountState']>
    >(async address => {
      if (address === sourceAddress) {
        return { status: 'active', account: source };
      }
      if (address === destinationAddress) {
        return destination === 'inactive'
          ? { status: 'inactive', address }
          : { status: 'active', account: destination };
      }
      return { status: 'inactive', address };
    }),
    loadLedgerParameters: jest.fn().mockResolvedValue({
      baseFeeStroops: 100,
      baseReserveStroops: 5_000_000,
    }),
    buildPayment: jest.fn(async input => {
      lastBuild = input;
      return {
        source: input.source,
        networkId: TEST_NETWORK.id,
        transactionXdrBase64: `payment-xdr-${input.operation}`,
      };
    }),
    inspectPaymentTransaction: jest.fn<
      ReturnType<PaymentGatewayPort['inspectPaymentTransaction']>,
      Parameters<PaymentGatewayPort['inspectPaymentTransaction']>
    >(() => {
      if (!lastBuild) {
        throw new Error('test-payment-not-built');
      }
      return {
        source: lastBuild.source,
        fee: lastBuild.baseFee,
        operation: lastBuild.operation,
        destination: lastBuild.destination,
        amount: canonicalAmount(lastBuild.amount),
        asset: lastBuild.asset,
        ...(lastBuild.memo === undefined ? {} : { memo: lastBuild.memo }),
      };
    }),
    transactionHash: jest.fn(),
    loadTransactionOutcome: jest.fn(),
    submitTransaction: jest.fn(),
  };
}

function dependencies(stellar: PaymentGatewayPort) {
  return { gateway: stellar, network: TEST_NETWORK } as const;
}

describe('preparePayment', () => {
  it('accepts only the current Normative Classic G destination scope', () => {
    const muxed = 'MDESTINATION';

    expect(validateClassicDestination(` ${destinationAddress} `, isClassicAddress)).toBe(destinationAddress);
    expect(() => validateClassicDestination(muxed, isClassicAddress)).toThrow('invalid-stellar-destination');
  });

  it('builds Payment with current ledger base fee for an existing destination', async () => {
    const stellar = gateway();

    const review = await preparePayment(dependencies(stellar), account(), {
      destination: destinationAddress,
      amount: '1',
      asset: { kind: 'native' },
    });

    expect(stellar.buildPayment).toHaveBeenCalledWith({
      operation: 'payment',
      source: sourceAddress,
      destination: destinationAddress,
      asset: { kind: 'native' },
      amount: '1',
      baseFee: '100',
    });
    expect(review).toMatchObject({
      operation: 'payment',
      amount: '1.0000000',
      fee: '100',
    });
  });

  it('uses CreateAccount only for native XLM to a missing destination', async () => {
    const stellar = gateway({ destination: 'inactive' });

    const review = await preparePayment(dependencies(stellar), account(), {
      destination: destinationAddress,
      amount: '1',
      asset: { kind: 'native' },
    });

    expect(review.operation).toBe('create-account');
    expect(stellar.buildPayment).toHaveBeenCalledWith(expect.objectContaining({ operation: 'create-account' }));

    await expect(
      preparePayment(dependencies(stellar), account(), {
        destination: destinationAddress,
        amount: '1',
        asset: { kind: 'credit', code: 'USD', issuer: sourceAddress },
      }),
    ).rejects.toThrow('payment-issued-asset-requires-existing-destination');
  });

  it('requires the current two-base-reserve minimum when creating an account', async () => {
    await expect(
      preparePayment(dependencies(gateway({ destination: 'inactive' })), account(), {
        destination: destinationAddress,
        amount: '0.9999999',
        asset: { kind: 'native' },
      }),
    ).rejects.toThrow('payment-create-account-below-minimum-balance');
  });

  it('preflights native source selling liabilities, minimum balance and fee', async () => {
    const source = activeAccount(sourceAddress, {
      native: '2.0000100',
      nativeSelling: '0.5000000',
    });

    await expect(
      preparePayment(dependencies(gateway({ source })), account(), {
        destination: destinationAddress,
        amount: '0.5000001',
        asset: { kind: 'native' },
      }),
    ).rejects.toThrow('payment-insufficient-source-balance');
  });

  it('requires full source trustline authorization and available issued balance', async () => {
    const unauthorized = activeAccount(sourceAddress, {
      trustline: {
        code: 'USD',
        issuer: issuerAddress,
        balance: '5',
        authorized: false,
      },
    });
    const destination = activeAccount(destinationAddress, {
      trustline: {
        code: 'USD',
        issuer: issuerAddress,
        balance: '0',
        limit: '100',
      },
    });

    await expect(
      preparePayment(dependencies(gateway({ source: unauthorized, destination })), account(), {
        destination: destinationAddress,
        amount: '1',
        asset: { kind: 'credit', code: 'USD', issuer: issuerAddress },
      }),
    ).rejects.toThrow('payment-source-trustline-not-authorized');

    const constrained = activeAccount(sourceAddress, {
      trustline: {
        code: 'USD',
        issuer: issuerAddress,
        balance: '5',
        selling: '4.5',
      },
    });
    await expect(
      preparePayment(dependencies(gateway({ source: constrained, destination })), account(), {
        destination: destinationAddress,
        amount: '0.5000001',
        asset: { kind: 'credit', code: 'USD', issuer: issuerAddress },
      }),
    ).rejects.toThrow('payment-insufficient-source-balance');
  });

  it('treats source issuer issuance as a special case but still requires XLM fee capacity', async () => {
    const issuerSource = activeAccount(sourceAddress, { native: '1.0000100' });
    const destination = activeAccount(destinationAddress, {
      trustline: {
        code: 'usd',
        issuer: sourceAddress,
        balance: '0',
        limit: '100',
      },
    });

    await expect(
      preparePayment(dependencies(gateway({ source: issuerSource, destination })), account(), {
        destination: destinationAddress,
        amount: '50',
        asset: { kind: 'credit', code: 'usd', issuer: sourceAddress },
      }),
    ).resolves.toMatchObject({
      operation: 'payment',
      asset: { kind: 'credit', code: 'usd', issuer: sourceAddress },
    });
  });

  it('requires destination issued trustline full authorization and receiving headroom', async () => {
    const source = activeAccount(sourceAddress, {
      trustline: {
        code: 'USD',
        issuer: issuerAddress,
        balance: '10',
      },
    });
    const destination = activeAccount(destinationAddress, {
      trustline: {
        code: 'USD',
        issuer: issuerAddress,
        balance: '9.5',
        buying: '0.25',
        limit: '10',
      },
    });

    await expect(
      preparePayment(dependencies(gateway({ source, destination })), account(), {
        destination: destinationAddress,
        amount: '0.2500001',
        asset: { kind: 'credit', code: 'USD', issuer: issuerAddress },
      }),
    ).rejects.toThrow('payment-destination-insufficient-capacity');

    const unauthorizedDestination = activeAccount(destinationAddress, {
      trustline: {
        code: 'USD',
        issuer: issuerAddress,
        balance: '0',
        limit: '10',
        authorized: false,
      },
    });
    await expect(
      preparePayment(dependencies(gateway({ source, destination: unauthorizedDestination })), account(), {
        destination: destinationAddress,
        amount: '1',
        asset: { kind: 'credit', code: 'USD', issuer: issuerAddress },
      }),
    ).rejects.toThrow('payment-destination-trustline-not-authorized');
  });

  it('treats destination issuer redemption as a special case without self-trustline', async () => {
    const source = activeAccount(sourceAddress, {
      trustline: {
        code: 'USD',
        issuer: destinationAddress,
        balance: '2',
      },
    });
    const issuerDestination = activeAccount(destinationAddress);

    await expect(
      preparePayment(dependencies(gateway({ source, destination: issuerDestination })), account(), {
        destination: destinationAddress,
        amount: '1',
        asset: { kind: 'credit', code: 'USD', issuer: destinationAddress },
      }),
    ).resolves.toMatchObject({ operation: 'payment' });
  });

  it('enforces SEP-29 memo-required destination before building XDR', async () => {
    const stellar = gateway({
      destination: activeAccount(destinationAddress, { memoRequired: true }),
    });

    await expect(
      preparePayment(dependencies(stellar), account(), {
        destination: destinationAddress,
        amount: '1',
        asset: { kind: 'native' },
      }),
    ).rejects.toThrow('payment-destination-requires-memo');
    expect(stellar.buildPayment).not.toHaveBeenCalled();
  });

  it('preserves valid text memo whitespace exactly instead of trimming semantic content', async () => {
    expect(validatePaymentTextMemo(' memo ')).toBe(' memo ');
    const stellar = gateway();

    const review = await preparePayment(dependencies(stellar), account(), {
      destination: destinationAddress,
      amount: '1',
      asset: { kind: 'native' },
      memo: ' memo ',
    });

    expect(stellar.buildPayment).toHaveBeenCalledWith(expect.objectContaining({ memo: ' memo ' }));
    expect(review.memo).toBe(' memo ');
  });

  it('rejects a platform projection that drops the preflighted memo', async () => {
    const stellar = gateway();
    stellar.inspectPaymentTransaction.mockReturnValueOnce({
      source: sourceAddress,
      fee: '100',
      operation: 'payment',
      destination: destinationAddress,
      amount: '1.0000000',
      asset: { kind: 'native' },
    });

    await expect(
      preparePayment(dependencies(stellar), account(), {
        destination: destinationAddress,
        amount: '1',
        asset: { kind: 'native' },
        memo: 'required semantics',
      }),
    ).rejects.toThrow('payment-review-context-mismatch');
  });

  it('rejects a platform projection whose fee differs from the preflighted ledger fee', async () => {
    const stellar = gateway();
    stellar.inspectPaymentTransaction.mockReturnValueOnce({
      source: sourceAddress,
      fee: '200',
      operation: 'payment',
      destination: destinationAddress,
      amount: '1.0000000',
      asset: { kind: 'native' },
    });

    await expect(
      preparePayment(dependencies(stellar), account(), {
        destination: destinationAddress,
        amount: '1',
        asset: { kind: 'native' },
      }),
    ).rejects.toThrow('payment-review-context-mismatch');
  });

  it('preserves valid issued asset code case as part of identity', () => {
    expect(validatePaymentAsset({ kind: 'credit', code: 'usd', issuer: issuerAddress }, isClassicAddress)).toEqual({
      kind: 'credit',
      code: 'usd',
      issuer: issuerAddress,
    });
    expect(validatePaymentAsset({ kind: 'credit', code: 'USD', issuer: issuerAddress }, isClassicAddress)).not.toEqual(
      validatePaymentAsset({ kind: 'credit', code: 'usd', issuer: issuerAddress }, isClassicAddress),
    );
  });
});
