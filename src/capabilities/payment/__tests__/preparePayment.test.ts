import {
  Account,
  Asset,
  Memo,
  Networks,
  Operation,
  StrKey,
  TransactionBuilder,
} from '@stellar/stellar-sdk';

import type {AccountRecord} from '../../account/types';
import type {StellarGateway} from '../../../platform/stellar/StellarGateway';
import type {StellarAccountState} from '../../../platform/stellar/types';
import {
  preparePayment,
  validateClassicDestination,
  validatePaymentAsset,
  validatePaymentTextMemo,
} from '../preparePayment';

const sourceAddress = StrKey.encodeEd25519PublicKey(new Uint8Array(32).fill(61));
const destinationAddress = StrKey.encodeEd25519PublicKey(new Uint8Array(32).fill(62));
const issuerAddress = StrKey.encodeEd25519PublicKey(new Uint8Array(32).fill(63));

function account(): AccountRecord {
  const now = new Date('2026-09-01T00:00:00.000Z');
  return {
    id: 'account-payment',
    address: sourceAddress,
    identityKind: 'classic',
    networkId: 'stellar-testnet',
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
    flags: {authRequired: false, authClawbackEnabled: false},
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
              ...(options.trustline.limit === undefined
                ? {}
                : {limit: options.trustline.limit}),
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

function gateway(options?: {
  source?: StellarAccountState;
  destination?: StellarAccountState | 'inactive';
}): jest.Mocked<StellarGateway> {
  const source = options?.source ?? activeAccount(sourceAddress);
  const destination = options?.destination ?? activeAccount(destinationAddress);

  return {
    loadAccountAuthorization: jest.fn(),
    loadAccountBalances: jest.fn(),
    loadAccountState: jest.fn(async address => {
      if (address === sourceAddress) {
        return {status: 'active', account: source};
      }
      if (address === destinationAddress) {
        return destination === 'inactive'
          ? {status: 'inactive', address}
          : {status: 'active', account: destination};
      }
      return {status: 'inactive', address};
    }),
    loadAccountOperations: jest.fn(),
    loadLedgerParameters: jest.fn().mockResolvedValue({
      baseFeeStroops: 100,
      baseReserveStroops: 5_000_000,
    }),
    loadLiquidityPool: jest.fn(),
    buildPayment: jest.fn(async input => {
      let builder = new TransactionBuilder(new Account(input.source, '10'), {
        fee: input.baseFee,
        networkPassphrase: Networks.TESTNET,
      }).addOperation(
        input.operation === 'create-account'
          ? Operation.createAccount({
              destination: input.destination,
              startingBalance: input.amount,
            })
          : Operation.payment({
              destination: input.destination,
              asset:
                input.asset.kind === 'native'
                  ? Asset.native()
                  : new Asset(input.asset.code, input.asset.issuer),
              amount: input.amount,
            }),
      );
      if (input.memo !== undefined) {
        builder = builder.addMemo(Memo.text(input.memo));
      }
      return {
        source: input.source,
        networkId: 'stellar-testnet',
        transactionXdrBase64: builder.setTimeout(180).build().toXdr(),
      };
    }),
    buildChangeTrust: jest.fn(),
    submitTransaction: jest.fn(),
  } as jest.Mocked<StellarGateway>;
}

describe('preparePayment', () => {
  it('accepts only the current Normative Classic G destination scope', () => {
    const muxed = StrKey.encodeMed25519PublicKey(new Uint8Array(40).fill(64));

    expect(validateClassicDestination(` ${destinationAddress} `)).toBe(destinationAddress);
    expect(() => validateClassicDestination(muxed)).toThrow('invalid-stellar-destination');
  });

  it('builds Payment with current ledger base fee for an existing destination', async () => {
    const stellar = gateway();

    const review = await preparePayment(
      {gateway: stellar},
      account(),
      {destination: destinationAddress, amount: '1', asset: {kind: 'native'}},
    );

    expect(stellar.buildPayment).toHaveBeenCalledWith({
      operation: 'payment',
      source: sourceAddress,
      destination: destinationAddress,
      asset: {kind: 'native'},
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
    const stellar = gateway({destination: 'inactive'});

    const review = await preparePayment(
      {gateway: stellar},
      account(),
      {destination: destinationAddress, amount: '1', asset: {kind: 'native'}},
    );

    expect(review.operation).toBe('create-account');
    expect(stellar.buildPayment).toHaveBeenCalledWith(
      expect.objectContaining({operation: 'create-account'}),
    );

    await expect(
      preparePayment(
        {gateway: stellar},
        account(),
        {
          destination: destinationAddress,
          amount: '1',
          asset: {kind: 'credit', code: 'USD', issuer: sourceAddress},
        },
      ),
    ).rejects.toThrow('payment-issued-asset-requires-existing-destination');
  });

  it('requires the current two-base-reserve minimum when creating an account', async () => {
    await expect(
      preparePayment(
        {gateway: gateway({destination: 'inactive'})},
        account(),
        {destination: destinationAddress, amount: '0.9999999', asset: {kind: 'native'}},
      ),
    ).rejects.toThrow('payment-create-account-below-minimum-balance');
  });

  it('preflights native source selling liabilities, minimum balance and fee', async () => {
    const source = activeAccount(sourceAddress, {
      native: '2.0000100',
      nativeSelling: '0.5000000',
    });

    await expect(
      preparePayment(
        {gateway: gateway({source})},
        account(),
        {destination: destinationAddress, amount: '0.5000001', asset: {kind: 'native'}},
      ),
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
      preparePayment(
        {gateway: gateway({source: unauthorized, destination})},
        account(),
        {
          destination: destinationAddress,
          amount: '1',
          asset: {kind: 'credit', code: 'USD', issuer: issuerAddress},
        },
      ),
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
      preparePayment(
        {gateway: gateway({source: constrained, destination})},
        account(),
        {
          destination: destinationAddress,
          amount: '0.5000001',
          asset: {kind: 'credit', code: 'USD', issuer: issuerAddress},
        },
      ),
    ).rejects.toThrow('payment-insufficient-source-balance');
  });

  it('treats source issuer issuance as a special case but still requires XLM fee capacity', async () => {
    const issuerSource = activeAccount(sourceAddress, {native: '1.0000100'});
    const destination = activeAccount(destinationAddress, {
      trustline: {
        code: 'usd',
        issuer: sourceAddress,
        balance: '0',
        limit: '100',
      },
    });

    await expect(
      preparePayment(
        {gateway: gateway({source: issuerSource, destination})},
        account(),
        {
          destination: destinationAddress,
          amount: '50',
          asset: {kind: 'credit', code: 'usd', issuer: sourceAddress},
        },
      ),
    ).resolves.toMatchObject({
      operation: 'payment',
      asset: {kind: 'credit', code: 'usd', issuer: sourceAddress},
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
      preparePayment(
        {gateway: gateway({source, destination})},
        account(),
        {
          destination: destinationAddress,
          amount: '0.2500001',
          asset: {kind: 'credit', code: 'USD', issuer: issuerAddress},
        },
      ),
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
      preparePayment(
        {gateway: gateway({source, destination: unauthorizedDestination})},
        account(),
        {
          destination: destinationAddress,
          amount: '1',
          asset: {kind: 'credit', code: 'USD', issuer: issuerAddress},
        },
      ),
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
      preparePayment(
        {gateway: gateway({source, destination: issuerDestination})},
        account(),
        {
          destination: destinationAddress,
          amount: '1',
          asset: {kind: 'credit', code: 'USD', issuer: destinationAddress},
        },
      ),
    ).resolves.toMatchObject({operation: 'payment'});
  });

  it('enforces SEP-29 memo-required destination before building XDR', async () => {
    const stellar = gateway({
      destination: activeAccount(destinationAddress, {memoRequired: true}),
    });

    await expect(
      preparePayment(
        {gateway: stellar},
        account(),
        {destination: destinationAddress, amount: '1', asset: {kind: 'native'}},
      ),
    ).rejects.toThrow('payment-destination-requires-memo');
    expect(stellar.buildPayment).not.toHaveBeenCalled();
  });

  it('preserves valid text memo whitespace exactly instead of trimming semantic content', async () => {
    expect(validatePaymentTextMemo(' memo ')).toBe(' memo ');
    const stellar = gateway();

    const review = await preparePayment(
      {gateway: stellar},
      account(),
      {
        destination: destinationAddress,
        amount: '1',
        asset: {kind: 'native'},
        memo: ' memo ',
      },
    );

    expect(stellar.buildPayment).toHaveBeenCalledWith(
      expect.objectContaining({memo: ' memo '}),
    );
    expect(review.memo).toBe(' memo ');
  });

  it('rejects a built XDR that drops the preflighted memo', async () => {
    const stellar = gateway();
    stellar.buildPayment.mockImplementationOnce(async input => ({
      source: input.source,
      networkId: 'stellar-testnet',
      transactionXdrBase64: new TransactionBuilder(new Account(input.source, '10'), {
        fee: input.baseFee,
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          Operation.payment({
            destination: input.destination,
            asset: Asset.native(),
            amount: input.amount,
          }),
        )
        .setTimeout(180)
        .build()
        .toXdr(),
    }));

    await expect(
      preparePayment(
        {gateway: stellar},
        account(),
        {
          destination: destinationAddress,
          amount: '1',
          asset: {kind: 'native'},
          memo: 'required semantics',
        },
      ),
    ).rejects.toThrow('payment-review-context-mismatch');
  });

  it('rejects a built XDR whose fee differs from the preflighted ledger fee', async () => {
    const stellar = gateway();
    stellar.buildPayment.mockImplementationOnce(async input => ({
      source: input.source,
      networkId: 'stellar-testnet',
      transactionXdrBase64: new TransactionBuilder(new Account(input.source, '10'), {
        fee: '200',
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          Operation.payment({
            destination: input.destination,
            asset: Asset.native(),
            amount: input.amount,
          }),
        )
        .setTimeout(180)
        .build()
        .toXdr(),
    }));

    await expect(
      preparePayment(
        {gateway: stellar},
        account(),
        {destination: destinationAddress, amount: '1', asset: {kind: 'native'}},
      ),
    ).rejects.toThrow('payment-review-context-mismatch');
  });

  it('preserves valid issued asset code case as part of identity', () => {
    expect(validatePaymentAsset({kind: 'credit', code: 'usd', issuer: issuerAddress})).toEqual({
      kind: 'credit',
      code: 'usd',
      issuer: issuerAddress,
    });
    expect(validatePaymentAsset({kind: 'credit', code: 'USD', issuer: issuerAddress})).not.toEqual(
      validatePaymentAsset({kind: 'credit', code: 'usd', issuer: issuerAddress}),
    );
  });
});
