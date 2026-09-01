import { Account, Asset, Networks, StrKey, Transaction } from '@stellar/stellar-sdk';

import { StellarSdkGateway } from '../StellarSdkGateway';
import type {
  HorizonAccountLike,
  HorizonOperationLike,
  HorizonServerLike,
} from '../types';

const sourceAddress = StrKey.encodeEd25519PublicKey(new Uint8Array(32).fill(1));
const destinationAddress = StrKey.encodeEd25519PublicKey(new Uint8Array(32).fill(2));
const signerAddress = StrKey.encodeEd25519PublicKey(new Uint8Array(32).fill(3));

function horizonAccount(): HorizonAccountLike {
  return Object.assign(new Account(sourceAddress, '100'), {
    account_id: sourceAddress,
    subentry_count: 0,
    num_sponsoring: 0,
    num_sponsored: 0,
    flags: {
      auth_required: false,
      auth_clawback_enabled: false,
    },
    thresholds: {
      low_threshold: 1,
      med_threshold: 2,
      high_threshold: 3,
    },
    signers: [
      { key: sourceAddress, weight: 1, type: 'ed25519_public_key' },
      { key: signerAddress, weight: 2, type: 'ed25519_public_key' },
    ],
    balances: [],
  });
}

function operation(id: string): HorizonOperationLike {
  return {
    id,
    paging_token: id,
    type: 'payment',
    type_i: 1,
    created_at: '2026-08-31T00:00:00Z',
    transaction_hash: `tx-${id}`,
    transaction_successful: true,
    source_account: sourceAddress,
    from: sourceAddress,
    to: destinationAddress,
    amount: '1.0000000',
    asset_type: 'native',
  };
}

function server(account = horizonAccount()): jest.Mocked<HorizonServerLike> {
  return {
    loadAccount: jest.fn().mockResolvedValue(account),
    loadAccountOperations: jest.fn().mockResolvedValue({records: []}),
    loadLedgerParameters: jest.fn().mockResolvedValue({
      base_fee_in_stroops: 100,
      base_reserve_in_stroops: 5_000_000,
    }),
    loadLiquidityPool: jest.fn().mockResolvedValue({id: 'pool-id', reserves: []}),
    submitTransaction: jest.fn(),
  };
}

function transactionHashHex(xdr: string): string {
  const transaction = new Transaction(xdr, Networks.TESTNET);
  return Array.from(transaction.hash())
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function paymentXdr(gateway: StellarSdkGateway): Promise<string> {
  const built = await gateway.buildPayment({
    operation: 'payment',
    source: sourceAddress,
    destination: destinationAddress,
    asset: { kind: 'native' },
    amount: '1.2500000',
    memo: 'hello',
    baseFee: '100',
  });
  return built.transactionXdrBase64;
}

describe('StellarSdkGateway', () => {
  it('maps Horizon thresholds and typed Ed25519 signers into ledger authorization', async () => {
    const gateway = new StellarSdkGateway(server());

    await expect(gateway.loadAccountAuthorization(sourceAddress)).resolves.toEqual({
      address: sourceAddress,
      thresholds: { low: 1, medium: 2, high: 3 },
      signers: [
        { kind: 'ed25519', publicKey: sourceAddress, weight: 1 },
        { kind: 'ed25519', publicKey: signerAddress, weight: 2 },
      ],
    });
  });

  it('preserves non-Ed25519 ledger signer identity kinds', async () => {
    const account = horizonAccount();
    account.signers = [
      { key: 'PREAUTH', weight: 1, type: 'preauth_tx' },
      { key: 'HASHX', weight: 2, type: 'sha256_hash' },
      { key: 'PAYLOAD', weight: 3, type: 'ed25519_signed_payload' },
    ];
    const gateway = new StellarSdkGateway(server(account));

    await expect(gateway.loadAccountAuthorization(sourceAddress)).resolves.toMatchObject({
      signers: [
        { kind: 'preauth-tx', key: 'PREAUTH', weight: 1 },
        { kind: 'hash-x', key: 'HASHX', weight: 2 },
        { kind: 'signed-payload', key: 'PAYLOAD', weight: 3 },
      ],
    });
  });

  it('fails closed on an unknown Horizon signer type', async () => {
    const account = horizonAccount();
    account.signers = [{ key: 'UNKNOWN', weight: 1, type: 'future_signer_type' }];
    const gateway = new StellarSdkGateway(server(account));

    await expect(gateway.loadAccountAuthorization(sourceAddress)).rejects.toThrow(
      'unsupported-ledger-signer-type:future_signer_type',
    );
  });

  it('maps native, issued and liquidity-pool balances without numeric conversion', async () => {
    const account = horizonAccount();
    account.balances = [
      {asset_type: 'native', balance: '12.3456789'},
      {
        asset_type: 'credit_alphanum4',
        balance: '7.0000001',
        asset_code: 'USD',
        asset_issuer: signerAddress,
      },
      {
        asset_type: 'liquidity_pool_shares',
        balance: '0.1250000',
        liquidity_pool_id: 'pool-id',
      },
    ];
    const gateway = new StellarSdkGateway(server(account));

    await expect(gateway.loadAccountBalances(sourceAddress)).resolves.toEqual({
      status: 'active',
      address: sourceAddress,
      balances: [
        {kind: 'native', balance: '12.3456789'},
        {kind: 'credit', balance: '7.0000001', code: 'USD', issuer: signerAddress},
        {
          kind: 'liquidity-pool-share',
          balance: '0.1250000',
          liquidityPoolId: 'pool-id',
        },
      ],
    });
  });

  it('maps the account facts required by Trustline preflight', async () => {
    const account = horizonAccount();
    account.subentry_count = 4;
    account.num_sponsoring = 2;
    account.num_sponsored = 1;
    account.flags = {auth_required: true, auth_clawback_enabled: true};
    account.balances = [
      {
        asset_type: 'native',
        balance: '20.0000000',
        selling_liabilities: '1.0000000',
      },
      {
        asset_type: 'credit_alphanum4',
        balance: '3.0000000',
        buying_liabilities: '0.5000000',
        selling_liabilities: '0.2500000',
        asset_code: 'USD',
        asset_issuer: signerAddress,
        is_authorized: false,
        is_authorized_to_maintain_liabilities: true,
        is_clawback_enabled: true,
      },
    ];

    await expect(
      new StellarSdkGateway(server(account)).loadAccountState(sourceAddress),
    ).resolves.toEqual({
      status: 'active',
      account: {
        address: sourceAddress,
        subentryCount: 4,
        numSponsoring: 2,
        numSponsored: 1,
        memoRequired: false,
        flags: {authRequired: true, authClawbackEnabled: true},
        balances: [
          {
            kind: 'native',
            balance: '20.0000000',
            buyingLiabilities: '0',
            sellingLiabilities: '1.0000000',
          },
          {
            kind: 'credit',
            balance: '3.0000000',
            buyingLiabilities: '0.5000000',
            sellingLiabilities: '0.2500000',
            code: 'USD',
            issuer: signerAddress,
            isAuthorized: false,
            isAuthorizedToMaintainLiabilities: true,
            isClawbackEnabled: true,
          },
        ],
      },
    });
  });

  it('returns inactive when Horizon reports the account does not exist', async () => {
    const horizon = server();
    horizon.loadAccount.mockRejectedValue({response: {status: 404}});
    const gateway = new StellarSdkGateway(horizon);

    await expect(gateway.loadAccountBalances(sourceAddress)).resolves.toEqual({
      status: 'inactive',
      address: sourceAddress,
    });
    await expect(gateway.loadAccountState(sourceAddress)).resolves.toEqual({
      status: 'inactive',
      address: sourceAddress,
    });
  });

  it('fails closed on malformed or unknown balance types', async () => {
    const malformed = horizonAccount();
    malformed.balances = [{asset_type: 'credit_alphanum4', balance: '1.0000000'}];
    await expect(
      new StellarSdkGateway(server(malformed)).loadAccountBalances(sourceAddress),
    ).rejects.toThrow('invalid-horizon-credit-balance:credit_alphanum4');

    const unknown = horizonAccount();
    unknown.balances = [{asset_type: 'future_asset', balance: '1.0000000'}];
    await expect(
      new StellarSdkGateway(server(unknown)).loadAccountBalances(sourceAddress),
    ).rejects.toThrow('unsupported-horizon-balance-type:future_asset');
  });

  it('loads account operations in descending cursor pages', async () => {
    const horizon = server();
    horizon.loadAccountOperations.mockResolvedValue({
      records: [operation('300'), operation('200')],
    });
    const gateway = new StellarSdkGateway(horizon);

    await expect(
      gateway.loadAccountOperations({
        address: sourceAddress,
        cursor: '400',
        limit: 2,
      }),
    ).resolves.toEqual({
      status: 'active',
      address: sourceAddress,
      records: [operation('300'), operation('200')],
      nextCursor: '200',
    });
    expect(horizon.loadAccountOperations).toHaveBeenCalledWith({
      address: sourceAddress,
      cursor: '400',
      limit: 2,
    });
  });

  it('omits a history cursor for a short final page', async () => {
    const horizon = server();
    horizon.loadAccountOperations.mockResolvedValue({records: [operation('100')]});

    await expect(
      new StellarSdkGateway(horizon).loadAccountOperations({
        address: sourceAddress,
        limit: 2,
      }),
    ).resolves.toEqual({
      status: 'active',
      address: sourceAddress,
      records: [operation('100')],
    });
  });

  it('returns inactive for a missing operation-history account', async () => {
    const horizon = server();
    horizon.loadAccountOperations.mockRejectedValue({response: {status: 404}});

    await expect(
      new StellarSdkGateway(horizon).loadAccountOperations({
        address: sourceAddress,
        limit: 20,
      }),
    ).resolves.toEqual({status: 'inactive', address: sourceAddress});
  });

  it('rejects invalid Horizon operation page sizes before network access', async () => {
    const horizon = server();
    const gateway = new StellarSdkGateway(horizon);

    await expect(
      gateway.loadAccountOperations({address: sourceAddress, limit: 0}),
    ).rejects.toThrow('invalid-horizon-operation-page-limit');
    await expect(
      gateway.loadAccountOperations({address: sourceAddress, limit: 201}),
    ).rejects.toThrow('invalid-horizon-operation-page-limit');
    expect(horizon.loadAccountOperations).not.toHaveBeenCalled();
  });

  it('normalizes ledger parameters and liquidity-pool reserve identities', async () => {
    const horizon = server();
    horizon.loadLedgerParameters.mockResolvedValue({
      base_fee_in_stroops: 120,
      base_reserve_in_stroops: 5_000_000,
    });
    horizon.loadLiquidityPool.mockResolvedValue({
      id: 'pool-id',
      reserves: [{asset: 'native'}, {asset: `USD:${signerAddress}`}],
    });
    const gateway = new StellarSdkGateway(horizon);

    await expect(gateway.loadLedgerParameters()).resolves.toEqual({
      baseFeeStroops: 120,
      baseReserveStroops: 5_000_000,
    });
    await expect(gateway.loadLiquidityPool('pool-id')).resolves.toEqual({
      id: 'pool-id',
      reserveAssets: ['native', `USD:${signerAddress}`],
    });
  });

  it('builds an unsigned native-asset payment on Stellar Testnet', async () => {
    const gateway = new StellarSdkGateway(server());
    const xdr = await paymentXdr(gateway);
    const transaction = new Transaction(xdr, Networks.TESTNET);
    const operation = transaction.operations[0];

    expect(transaction.networkPassphrase).toBe(Networks.TESTNET);
    expect(transaction.signatures).toHaveLength(0);
    expect(transaction.operations).toHaveLength(1);
    expect(operation.type).toBe('payment');
    if (operation.type !== 'payment') {
      throw new Error('Expected payment operation');
    }
    expect(operation.destination).toBe(destinationAddress);
    expect(operation.amount).toBe('1.2500000');
    expect(operation.asset.isNative()).toBe(true);
    expect(transaction.memo.type).toBe('text');
  });

  it('builds an unsigned ordinary ChangeTrust transaction with the requested limit', async () => {
    const gateway = new StellarSdkGateway(server());
    const built = await gateway.buildChangeTrust({
      source: sourceAddress,
      code: 'USD',
      issuer: signerAddress,
      limit: '708269837873.6765',
      baseFee: '100',
    });
    const transaction = new Transaction(built.transactionXdrBase64, Networks.TESTNET);
    const changeTrust = transaction.operations[0];

    expect(transaction.signatures).toHaveLength(0);
    expect(changeTrust.type).toBe('changeTrust');
    if (changeTrust.type !== 'changeTrust') {
      throw new Error('Expected ChangeTrust operation');
    }
    expect(changeTrust.line).toBeInstanceOf(Asset);
    expect(changeTrust.limit).toBe('708269837873.6765000');
  });

  it('normalizes an accepted submission', async () => {
    const horizon = server();
    horizon.submitTransaction.mockResolvedValue({ hash: 'accepted-hash', ledger: 77 });
    const gateway = new StellarSdkGateway(horizon);
    const xdr = await paymentXdr(gateway);

    await expect(gateway.submitTransaction(xdr)).resolves.toEqual({
      status: 'accepted',
      hash: 'accepted-hash',
      ledger: 77,
    });
  });

  it('normalizes a deterministic Horizon rejection with the exact transaction hash', async () => {
    const horizon = server();
    horizon.submitTransaction.mockRejectedValue({
      response: {
        status: 400,
        data: { extras: { result_codes: { transaction: 'tx_bad_seq' } } },
      },
    });
    const gateway = new StellarSdkGateway(horizon);
    const xdr = await paymentXdr(gateway);

    await expect(gateway.submitTransaction(xdr)).resolves.toEqual({
      status: 'rejected',
      transactionHash: transactionHashHex(xdr),
      resultCode: 'tx_bad_seq',
    });
  });

  it('normalizes a transport failure as uncertain without claiming rejection', async () => {
    const horizon = server();
    horizon.submitTransaction.mockRejectedValue(new Error('timeout'));
    const gateway = new StellarSdkGateway(horizon);
    const xdr = await paymentXdr(gateway);

    await expect(gateway.submitTransaction(xdr)).resolves.toEqual({
      status: 'uncertain',
      transactionHash: transactionHashHex(xdr),
    });
    expect(horizon.submitTransaction).toHaveBeenCalledTimes(1);
  });
});
