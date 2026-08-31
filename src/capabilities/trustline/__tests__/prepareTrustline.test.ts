import {StrKey} from '@stellar/stellar-sdk';

import type {AccountRecord} from '../../account/types';
import type {StellarGateway} from '../../../platform/stellar/StellarGateway';
import type {StellarAccountState} from '../../../platform/stellar/types';
import {
  DEFAULT_TRUSTLINE_LIMIT,
  prepareTrustline,
} from '../prepareTrustline';

const sourceAddress = StrKey.encodeEd25519PublicKey(new Uint8Array(32).fill(31));
const issuerAddress = StrKey.encodeEd25519PublicKey(new Uint8Array(32).fill(32));

function account(): AccountRecord {
  const now = new Date('2026-08-31T00:00:00.000Z');
  return {
    id: 'account-a',
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
    flags: {authRequired: false, authClawbackEnabled: false},
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

function issuerState(options?: {
  authRequired?: boolean;
  clawback?: boolean;
}): StellarAccountState {
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
): jest.Mocked<StellarGateway> {
  return {
    loadAccountAuthorization: jest.fn(),
    loadAccountBalances: jest.fn(),
    loadAccountState: jest.fn(async address => {
      if (address === sourceAddress) {
        return {status: 'active', account: source};
      }
      if (address === issuerAddress) {
        return {status: 'active', account: issuer};
      }
      return {status: 'inactive', address};
    }),
    loadAccountOperations: jest.fn(),
    loadLedgerParameters: jest.fn().mockResolvedValue({
      baseFeeStroops: 100,
      baseReserveStroops: 5_000_000,
    }),
    loadLiquidityPool: jest.fn().mockResolvedValue({
      id: 'pool-id',
      reserveAssets: ['native'],
    }),
    buildPayment: jest.fn(),
    buildChangeTrust: jest.fn(async input => ({
      source: input.source,
      networkId: 'stellar-testnet',
      transactionXdrBase64: buildChangeTrustXdr(input),
    })),
    submitTransaction: jest.fn(),
  } as jest.Mocked<StellarGateway>;
}

function buildChangeTrustXdr(input: {
  source: string;
  code: string;
  issuer: string;
  limit: string;
  baseFee: string;
}): string {
  const {Account, Asset, Networks, Operation, TransactionBuilder} = require('@stellar/stellar-sdk');
  return new TransactionBuilder(new Account(input.source, '10'), {
    fee: input.baseFee,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      Operation.changeTrust({
        asset: new Asset(input.code, input.issuer),
        limit: input.limit,
      }),
    )
    .setTimeout(180)
    .build()
    .toXdr();
}

describe('prepareTrustline', () => {
  it('uses the normative Fresnica canonical limit and issuer-derived initial state', async () => {
    const stellar = gateway(
      sourceState(),
      issuerState({authRequired: true, clawback: true}),
    );

    const review = await prepareTrustline(
      {gateway: stellar},
      account(),
      {action: 'add', asset: {code: 'USD', issuer: issuerAddress}},
    );

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
      prepareTrustline(
        {gateway: gateway(sourceState({trustlineBalance: '0'}))},
        account(),
        {action: 'add', asset: {code: 'USD', issuer: issuerAddress}},
      ),
    ).rejects.toThrow('trustline-already-exists');
  });

  it('requires the issuer to exist for add', async () => {
    const stellar = gateway(sourceState());
    stellar.loadAccountState.mockImplementation(async address =>
      address === sourceAddress
        ? {status: 'active', account: sourceState()}
        : {status: 'inactive', address},
    );

    await expect(
      prepareTrustline(
        {gateway: stellar},
        account(),
        {action: 'add', asset: {code: 'USD', issuer: issuerAddress}},
      ),
    ).rejects.toThrow('trustline-issuer-account-inactive');
  });

  it('preflights the additional reserve and fee before add', async () => {
    await expect(
      prepareTrustline(
        {gateway: gateway(sourceState({nativeBalance: '1.0000000'}))},
        account(),
        {action: 'add', asset: {code: 'USD', issuer: issuerAddress}},
      ),
    ).rejects.toThrow('trustline-insufficient-xlm-for-reserve-and-fee');
  });

  it('rejects remove while balance or liabilities are non-zero', async () => {
    for (const state of [
      sourceState({trustlineBalance: '0.0000001'}),
      sourceState({trustlineBalance: '0', buyingLiabilities: '0.0000001'}),
      sourceState({trustlineBalance: '0', sellingLiabilities: '0.0000001'}),
    ]) {
      await expect(
        prepareTrustline(
          {gateway: gateway(state)},
          account(),
          {action: 'remove', asset: {code: 'USD', issuer: issuerAddress}},
        ),
      ).rejects.toThrow('trustline-remove-nonzero-balance-or-liabilities');
    }
  });

  it('rejects remove while a held liquidity pool references the asset', async () => {
    const stellar = gateway(
      sourceState({trustlineBalance: '0', includePool: true}),
    );
    stellar.loadLiquidityPool.mockResolvedValue({
      id: 'pool-id',
      reserveAssets: [`USD:${issuerAddress}`, 'native'],
    });

    await expect(
      prepareTrustline(
        {gateway: stellar},
        account(),
        {action: 'remove', asset: {code: 'USD', issuer: issuerAddress}},
      ),
    ).rejects.toThrow('trustline-remove-used-by-liquidity-pool');
  });

  it('allows removal without requiring the issuer account to still exist', async () => {
    const stellar = gateway(sourceState({trustlineBalance: '0'}));

    const review = await prepareTrustline(
      {gateway: stellar},
      account(),
      {action: 'remove', asset: {code: 'USD', issuer: issuerAddress}},
    );

    expect(review.operation).toBe('remove');
    expect(stellar.loadAccountState).toHaveBeenCalledTimes(1);
    expect(stellar.buildChangeTrust).toHaveBeenCalledWith(
      expect.objectContaining({limit: '0'}),
    );
  });

  it('rejects invalid identity and issuer self-trust cases', async () => {
    await expect(
      prepareTrustline(
        {gateway: gateway(sourceState())},
        account(),
        {action: 'add', asset: {code: 'USD!', issuer: issuerAddress}},
      ),
    ).rejects.toThrow('invalid-trustline-asset-code');

    await expect(
      prepareTrustline(
        {gateway: gateway(sourceState())},
        account(),
        {action: 'add', asset: {code: 'USD', issuer: sourceAddress}},
      ),
    ).rejects.toThrow('trustline-issuer-cannot-trust-own-asset');
  });
});
