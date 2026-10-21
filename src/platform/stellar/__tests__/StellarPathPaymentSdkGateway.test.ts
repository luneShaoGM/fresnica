import {
  Account,
  Asset,
  Keypair,
  Networks,
  Operation,
  StrKey,
  Transaction,
  TransactionBuilder,
} from '@stellar/stellar-sdk';

import { preparePathPayment } from '../../../capabilities/path-payment/preparePathPayment';
import { loadPathPaymentQuotes } from '../../../capabilities/path-payment/loadPathPaymentQuotes';
import type { PathPaymentQuoteGatewayPort } from '../../../capabilities/path-payment/types';

import { StellarPathPaymentSdkGateway } from '../StellarPathPaymentSdkGateway';
import type { HorizonAccountLike, HorizonPathRecordLike, HorizonPathServerLike } from '../types';

const sourceAddress = StrKey.encodeEd25519PublicKey(new Uint8Array(32).fill(11));
const destinationAddress = StrKey.encodeEd25519PublicKey(new Uint8Array(32).fill(12));
const issuerAddress = StrKey.encodeEd25519PublicKey(new Uint8Array(32).fill(13));

const NATIVE_TO_USD_ENDPOINTS = Object.freeze({
  source_asset_type: 'native',
  destination_asset_type: 'credit_alphanum4',
  destination_asset_code: 'usd',
  destination_asset_issuer: issuerAddress,
});

const TEST_GATEWAY_CONFIG = Object.freeze({
  network: Object.freeze({ id: 'stellar-testnet', networkPassphrase: Networks.TESTNET }),
  horizonUrl: 'https://horizon-testnet.stellar.org',
});

type PathPaymentServer = HorizonPathServerLike & {
  loadAccount(address: string): Promise<HorizonAccountLike>;
};

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
      med_threshold: 1,
      high_threshold: 1,
    },
    signers: [],
    balances: [],
  });
}

function server(): jest.Mocked<PathPaymentServer> {
  return {
    loadAccount: jest.fn().mockResolvedValue(horizonAccount()),
    loadStrictSendPaths: jest.fn().mockResolvedValue({ records: [] }),
    loadStrictReceivePaths: jest.fn().mockResolvedValue({ records: [] }),
  };
}

describe('StellarPathPaymentSdkGateway', () => {
  it('normalizes strict-send Horizon routes without choosing or reordering them', async () => {
    const horizon = server();
    horizon.loadStrictSendPaths.mockResolvedValue({
      records: [
        {
          ...NATIVE_TO_USD_ENDPOINTS,
          source_amount: '1.0000000',
          destination_amount: '2.0000000',
          path: [
            {
              asset_type: 'credit_alphanum4',
              asset_code: 'usd',
              asset_issuer: issuerAddress,
            },
          ],
        },
        {
          ...NATIVE_TO_USD_ENDPOINTS,
          source_amount: '1.0000000',
          destination_amount: '9.0000000',
          path: [{ asset_type: 'native' }],
        },
      ],
    });
    const gateway = new StellarPathPaymentSdkGateway(TEST_GATEWAY_CONFIG, horizon);

    await expect(
      gateway.loadStrictSendPaths({
        sourceAsset: { kind: 'native' },
        sourceAmount: '1.0000000',
        destinationAssets: [{ kind: 'credit', code: 'usd', issuer: issuerAddress }],
      }),
    ).resolves.toEqual([
      {
        sourceAmount: '1.0000000',
        destinationAmount: '2.0000000',
        sourceAsset: { kind: 'native' },
        destinationAsset: { kind: 'credit', code: 'usd', issuer: issuerAddress },
        path: [{ kind: 'credit', code: 'usd', issuer: issuerAddress }],
      },
      {
        sourceAmount: '1.0000000',
        destinationAmount: '9.0000000',
        sourceAsset: { kind: 'native' },
        destinationAsset: { kind: 'credit', code: 'usd', issuer: issuerAddress },
        path: [{ kind: 'native' }],
      },
    ]);

    const call = horizon.loadStrictSendPaths.mock.calls[0][0];
    expect(call.sourceAsset.isNative()).toBe(true);
    expect(call.sourceAmount).toBe('1.0000000');
    expect(call.destinationAssets).toHaveLength(1);
    expect(call.destinationAssets[0].getCode()).toBe('usd');
    expect(call.destinationAssets[0].getIssuer()).toBe(issuerAddress);
  });

  it('binds the new quote Capability to this network-scoped Stellar SDK adapter', async () => {
    const horizon = server();
    horizon.loadStrictSendPaths.mockResolvedValue({
      records: [
        {
          ...NATIVE_TO_USD_ENDPOINTS,
          destination_asset_code: 'USDC',
          source_amount: '5.0000000',
          destination_amount: '10.0000000',
          path: [],
        },
      ],
    });
    const gateway = new StellarPathPaymentSdkGateway(TEST_GATEWAY_CONFIG, horizon);
    const quotePort: PathPaymentQuoteGatewayPort = gateway;

    expect(quotePort.network).toEqual(TEST_GATEWAY_CONFIG.network);
    const quotes = await loadPathPaymentQuotes(
      {
        gateway: quotePort,
        network: TEST_GATEWAY_CONFIG.network,
        isClassicAccountAddress: StrKey.isValidEd25519PublicKey,
        nowUnixMs: () => 1_782_000_000_000,
        nowMonotonicMs: () => 20_000,
      },
      {
        network: TEST_GATEWAY_CONFIG.network,
        source: sourceAddress,
        destination: destinationAddress,
        sourceAsset: { kind: 'native' },
        destinationAsset: { kind: 'credit', code: 'USDC', issuer: issuerAddress },
        mode: 'strict_send',
        fixedAmount: '5',
      },
    );
    expect(quotes).toHaveLength(1);
    expect(quotes[0]).toMatchObject({
      sourceAmount: '5.0000000',
      destinationAmount: '10.0000000',
      path: [],
      request: {
        source: sourceAddress,
        destination: destinationAddress,
        network: TEST_GATEWAY_CONFIG.network,
      },
    });
    expect(horizon.loadStrictSendPaths).toHaveBeenCalledTimes(1);
    expect(horizon.loadAccount).not.toHaveBeenCalled();
  });

  it('normalizes strict-receive Horizon routes with exact source and destination amounts', async () => {
    const horizon = server();
    horizon.loadStrictReceivePaths.mockResolvedValue({
      records: [
        {
          ...NATIVE_TO_USD_ENDPOINTS,
          source_amount: '3.1234567',
          destination_amount: '1.0000000',
          path: [],
        },
      ],
    });
    const gateway = new StellarPathPaymentSdkGateway(TEST_GATEWAY_CONFIG, horizon);

    await expect(
      gateway.loadStrictReceivePaths({
        sourceAssets: [{ kind: 'native' }],
        destinationAsset: { kind: 'credit', code: 'usd', issuer: issuerAddress },
        destinationAmount: '1.0000000',
      }),
    ).resolves.toEqual([
      {
        sourceAmount: '3.1234567',
        destinationAmount: '1.0000000',
        sourceAsset: { kind: 'native' },
        destinationAsset: { kind: 'credit', code: 'usd', issuer: issuerAddress },
        path: [],
      },
    ]);

    const call = horizon.loadStrictReceivePaths.mock.calls[0][0];
    expect(call.sourceAssets[0].isNative()).toBe(true);
    expect(call.destinationAsset.getCode()).toBe('usd');
    expect(call.destinationAsset.getIssuer()).toBe(issuerAddress);
    expect(call.destinationAmount).toBe('1.0000000');
  });

  it.each([
    [
      'strict_send',
      'source',
      { source_asset_type: 'credit_alphanum4', source_asset_code: 'EUR', source_asset_issuer: issuerAddress },
    ],
    ['strict_send', 'destination', { destination_asset_code: 'EUR' }],
    [
      'strict_receive',
      'source',
      { source_asset_type: 'credit_alphanum4', source_asset_code: 'EUR', source_asset_issuer: issuerAddress },
    ],
    ['strict_receive', 'destination', { destination_asset_code: 'EUR' }],
  ] as const)(
    'fails closed on Horizon %s quote with a misbound %s asset through the actual SDK gateway',
    async (mode, _side, badEndpoint) => {
      const horizon = server();
      const rawRecord = {
        ...NATIVE_TO_USD_ENDPOINTS,
        destination_asset_code: 'USDC',
        source_amount: '5.0000000',
        destination_amount: '10.0000000',
        path: [],
        ...badEndpoint,
      };
      horizon.loadStrictSendPaths.mockResolvedValue({ records: [rawRecord] });
      horizon.loadStrictReceivePaths.mockResolvedValue({ records: [rawRecord] });
      const sdkGateway = new StellarPathPaymentSdkGateway(TEST_GATEWAY_CONFIG, horizon);

      await expect(
        loadPathPaymentQuotes(
          {
            gateway: sdkGateway,
            network: TEST_GATEWAY_CONFIG.network,
            isClassicAccountAddress: StrKey.isValidEd25519PublicKey,
            nowUnixMs: () => 1_782_000_000_000,
            nowMonotonicMs: () => 20_000,
          },
          {
            network: TEST_GATEWAY_CONFIG.network,
            source: sourceAddress,
            destination: destinationAddress,
            sourceAsset: { kind: 'native' },
            destinationAsset: { kind: 'credit', code: 'USDC', issuer: issuerAddress },
            mode,
            fixedAmount: mode === 'strict_send' ? '5' : '10',
          },
        ),
      ).rejects.toThrow('quote_unavailable');
      expect(horizon.loadStrictSendPaths).toHaveBeenCalledTimes(mode === 'strict_send' ? 1 : 0);
      expect(horizon.loadStrictReceivePaths).toHaveBeenCalledTimes(mode === 'strict_receive' ? 1 : 0);
      expect(horizon.loadAccount).not.toHaveBeenCalled();
    },
  );

  it.each(['strict_send', 'strict_receive'] as const)(
    'rejects Horizon %s records with missing source/destination asset fields',
    async mode => {
      const horizon = server();
      const missingEndpoint = {
        source_amount: '5.0000000',
        destination_amount: '10.0000000',
        path: [],
      };
      horizon.loadStrictSendPaths.mockResolvedValue({
        records: [missingEndpoint as unknown as HorizonPathRecordLike],
      });
      horizon.loadStrictReceivePaths.mockResolvedValue({
        records: [missingEndpoint as unknown as HorizonPathRecordLike],
      });

      await expect(
        loadPathPaymentQuotes(
          {
            gateway: new StellarPathPaymentSdkGateway(TEST_GATEWAY_CONFIG, horizon),
            network: TEST_GATEWAY_CONFIG.network,
            isClassicAccountAddress: StrKey.isValidEd25519PublicKey,
            nowUnixMs: () => 1_782_000_000_000,
            nowMonotonicMs: () => 20_000,
          },
          {
            network: TEST_GATEWAY_CONFIG.network,
            source: sourceAddress,
            destination: destinationAddress,
            sourceAsset: { kind: 'native' },
            destinationAsset: { kind: 'credit', code: 'USDC', issuer: issuerAddress },
            mode,
            fixedAmount: mode === 'strict_send' ? '5' : '10',
          },
        ),
      ).rejects.toThrow('quote_unavailable');
    },
  );

  it('fails closed on malformed Horizon path assets', async () => {
    const horizon = server();
    horizon.loadStrictSendPaths.mockResolvedValue({
      records: [
        {
          ...NATIVE_TO_USD_ENDPOINTS,
          source_amount: '1.0000000',
          destination_amount: '2.0000000',
          path: [{ asset_type: 'credit_alphanum4', asset_code: 'usd' }],
        },
      ],
    });

    await expect(
      new StellarPathPaymentSdkGateway(TEST_GATEWAY_CONFIG, horizon).loadStrictSendPaths({
        sourceAsset: { kind: 'native' },
        sourceAmount: '1.0000000',
        destinationAssets: [{ kind: 'credit', code: 'usd', issuer: issuerAddress }],
      }),
    ).rejects.toThrow('invalid-horizon-path-asset:credit_alphanum4');
  });

  it('builds strict-send XDR from caller-provided path, protection amount, fee and timeout', async () => {
    const horizon = server();
    const built = await new StellarPathPaymentSdkGateway(TEST_GATEWAY_CONFIG, horizon).buildPathPaymentStrictSend({
      source: sourceAddress,
      destination: destinationAddress,
      sendAsset: { kind: 'native' },
      sendAmount: '4.0000000',
      destinationAsset: { kind: 'credit', code: 'usd', issuer: issuerAddress },
      destinationMinimum: '7.5000000',
      path: [{ kind: 'credit', code: 'eur', issuer: issuerAddress }],
      baseFee: '123',
      expiresAtUnixSeconds: 1_782_000_180,
    });
    const transaction = new Transaction(built.transactionXdrBase64, Networks.TESTNET);
    const operation = transaction.operations[0];

    expect(built.source).toBe(sourceAddress);
    expect(built.networkId).toBe('stellar-testnet');
    expect(transaction.fee).toBe('123');
    expect(transaction.signatures).toHaveLength(0);
    expect(operation.type).toBe('pathPaymentStrictSend');
    if (operation.type !== 'pathPaymentStrictSend') {
      throw new Error('Expected PathPaymentStrictSend operation');
    }
    expect(operation.sendAsset.isNative()).toBe(true);
    expect(operation.sendAmount).toBe('4.0000000');
    expect(operation.destination).toBe(destinationAddress);
    expect(operation.destAsset.getCode()).toBe('usd');
    expect(operation.destMin).toBe('7.5000000');
    expect(operation.path).toHaveLength(1);
    expect(operation.path[0].getCode()).toBe('eur');
  });

  it('builds strict-receive XDR from caller-provided maximum source amount', async () => {
    const horizon = server();
    const built = await new StellarPathPaymentSdkGateway(TEST_GATEWAY_CONFIG, horizon).buildPathPaymentStrictReceive({
      source: sourceAddress,
      destination: destinationAddress,
      sendAsset: { kind: 'credit', code: 'eur', issuer: issuerAddress },
      sendMaximum: '8.5000000',
      destinationAsset: { kind: 'native' },
      destinationAmount: '5.0000000',
      path: [{ kind: 'credit', code: 'usd', issuer: issuerAddress }],
      baseFee: '100',
      expiresAtUnixSeconds: 1_782_000_180,
    });
    const transaction = new Transaction(built.transactionXdrBase64, Networks.TESTNET);
    const operation = transaction.operations[0];

    expect(operation.type).toBe('pathPaymentStrictReceive');
    if (operation.type !== 'pathPaymentStrictReceive') {
      throw new Error('Expected PathPaymentStrictReceive operation');
    }
    expect(operation.sendAsset.getCode()).toBe('eur');
    expect(operation.sendMax).toBe('8.5000000');
    expect(operation.destination).toBe(destinationAddress);
    expect(operation.destAsset.isNative()).toBe(true);
    expect(operation.destAmount).toBe('5.0000000');
    expect(operation.path).toHaveLength(1);
    expect(operation.path[0].getCode()).toBe('usd');
  });

  it('independently decodes strict-send XDR, binding memo, path, fee and absolute TimeBounds', async () => {
    const horizon = server();
    const gateway = new StellarPathPaymentSdkGateway(TEST_GATEWAY_CONFIG, horizon);
    const built = await gateway.buildPathPaymentStrictSend({
      source: sourceAddress,
      destination: destinationAddress,
      sendAsset: { kind: 'native' },
      sendAmount: '5.0000000',
      destinationAsset: { kind: 'credit', code: 'USDC', issuer: issuerAddress },
      destinationMinimum: '9.9000000',
      path: [{ kind: 'credit', code: 'EUR', issuer: issuerAddress }],
      baseFee: '123',
      memo: { type: 'text', value: 'review me' },
      expiresAtUnixSeconds: 1_782_000_180,
    });
    const transaction = new Transaction(built.transactionXdrBase64, Networks.TESTNET);
    expect(transaction.timeBounds).toEqual({ minTime: '0', maxTime: '1782000180' });
    expect(transaction.signatures).toHaveLength(0);
    expect(
      gateway.inspectPathPaymentTransaction({
        transactionXdrBase64: built.transactionXdrBase64,
        networkPassphrase: Networks.TESTNET,
      }),
    ).toEqual({
      mode: 'strict_send',
      source: sourceAddress,
      destination: destinationAddress,
      sourceAsset: { kind: 'native' },
      destinationAsset: { kind: 'credit', code: 'USDC', issuer: issuerAddress },
      sendAmount: '5.0000000',
      destinationMinimum: '9.9000000',
      path: [{ kind: 'credit', code: 'EUR', issuer: issuerAddress }],
      fee: '123',
      minTimeUnixSeconds: 0,
      expiresAtUnixSeconds: 1_782_000_180,
      memo: { type: 'text', value: 'review me' },
    });
  });

  it.each([
    ['id', { type: 'id' as const, value: '18446744073709551615' }],
    ['hash', { type: 'hash' as const, value: 'a1'.repeat(32) }],
  ])('independently decodes strict-receive %s memo and exact sourceMax', async (_name, memo) => {
    const gateway = new StellarPathPaymentSdkGateway(TEST_GATEWAY_CONFIG, server());
    const built = await gateway.buildPathPaymentStrictReceive({
      source: sourceAddress,
      destination: destinationAddress,
      sendAsset: { kind: 'credit', code: 'EUR', issuer: issuerAddress },
      sendMaximum: '5.0500000',
      destinationAsset: { kind: 'native' },
      destinationAmount: '10.0000000',
      path: [{ kind: 'credit', code: 'USD', issuer: issuerAddress }],
      baseFee: '100',
      memo,
      expiresAtUnixSeconds: 1_782_000_180,
    });
    expect(
      gateway.inspectPathPaymentTransaction({
        transactionXdrBase64: built.transactionXdrBase64,
        networkPassphrase: Networks.TESTNET,
      }),
    ).toMatchObject({
      mode: 'strict_receive',
      source: sourceAddress,
      destination: destinationAddress,
      sourceAsset: { kind: 'credit', code: 'EUR', issuer: issuerAddress },
      destinationAsset: { kind: 'native' },
      path: [{ kind: 'credit', code: 'USD', issuer: issuerAddress }],
      sendMaximum: '5.0500000',
      destinationAmount: '10.0000000',
      memo,
      fee: '100',
      minTimeUnixSeconds: 0,
      expiresAtUnixSeconds: 1_782_000_180,
    });
  });

  it('builds and independently reviews actual SDK XDR only after two live C1 preflights', async () => {
    const horizon = server();
    const pathGateway = new StellarPathPaymentSdkGateway(TEST_GATEWAY_CONFIG, horizon);
    const issuedAsset = { kind: 'credit' as const, code: 'USDC', issuer: issuerAddress };
    const sourceState = {
      address: sourceAddress,
      subentryCount: 0,
      numSponsoring: 0,
      numSponsored: 0,
      flags: { authRequired: false, authClawbackEnabled: false },
      balances: [{ kind: 'native' as const, balance: '40', sellingLiabilities: '1', buyingLiabilities: '0' }],
    };
    const destState = {
      ...sourceState,
      address: destinationAddress,
      subentryCount: 1,
      balances: [
        ...sourceState.balances,
        {
          kind: 'credit' as const,
          code: 'USDC',
          issuer: issuerAddress,
          balance: '2',
          limit: '100',
          sellingLiabilities: '0',
          buyingLiabilities: '0',
          isAuthorized: true,
          isAuthorizedToMaintainLiabilities: false,
          isClawbackEnabled: false,
        },
      ],
    };
    const issuerState = { ...sourceState, address: issuerAddress };
    const preflightGateway = {
      network: TEST_GATEWAY_CONFIG.network,
      isClassicAccountAddress: StrKey.isValidEd25519PublicKey,
      loadAccountState: jest.fn(async (address: string) => {
        const state =
          address === sourceAddress
            ? sourceState
            : address === destinationAddress
              ? destState
              : address === issuerAddress
                ? issuerState
                : undefined;
        if (!state) return { status: 'inactive' as const, address };
        return { status: 'active' as const, account: state };
      }),
      loadLedgerParameters: jest.fn(async () => ({ baseReserveStroops: 5_000_000, baseFeeStroops: 100 })),
    };
    const NOW = 1_782_000_000_000;
    const quote = {
      request: {
        network: TEST_GATEWAY_CONFIG.network,
        source: sourceAddress,
        destination: destinationAddress,
        sourceAsset: { kind: 'native' as const },
        destinationAsset: issuedAsset,
        mode: 'strict_send' as const,
        fixedAmount: '5.0000000',
        memo: { type: 'text' as const, value: 'from real sdk' },
      },
      sourceAmount: '5.0000000',
      destinationAmount: '10.0000000',
      path: [],
      quotedAtUnixMs: NOW,
      expiresAtUnixMs: NOW + 30_000,
      quotedAtMonotonicMs: 20_000,
    };
    const review = await preparePathPayment(
      {
        preflight: {
          gateway: preflightGateway,
          network: TEST_GATEWAY_CONFIG.network,
          clock: { nowUnixMs: () => NOW + 1_000, nowMonotonicMs: () => 21_000 },
        },
        transactionGateway: pathGateway,
      },
      { address: sourceAddress, networkId: TEST_GATEWAY_CONFIG.network.id, identityKind: 'classic' },
      quote,
      { feeStroops: 100, slippageBps: 100, transactionTimeoutSeconds: 180 },
    );
    const decoded = new Transaction(review.transactionXdrBase64, Networks.TESTNET);
    expect(decoded.operations).toHaveLength(1);
    expect(decoded.operations[0]?.type).toBe('pathPaymentStrictSend');
    expect(decoded.signatures).toHaveLength(0);
    expect(decoded.fee).toBe('100');
    expect(decoded.timeBounds).toEqual({ minTime: '0', maxTime: String(NOW / 1000 + 181) });
    expect(review).toMatchObject({
      quote,
      source: sourceAddress,
      destination: destinationAddress,
      sourceAsset: { kind: 'native' },
      destinationAsset: issuedAsset,
      quotedSourceAmount: '5.0000000',
      quotedDestinationAmount: '10.0000000',
      destinationMinimum: '9.9000000',
      fee: '100',
      memo: { type: 'text', value: 'from real sdk' },
      mode: 'strict_send',
      slippageBps: 100,
    });
    expect(horizon.loadAccount).toHaveBeenCalledTimes(1);
    expect(preflightGateway.loadLedgerParameters).toHaveBeenCalledTimes(2);
    expect(preflightGateway.loadAccountState).toHaveBeenCalledTimes(6);
  });

  it('rejects an SDK source-account response that belongs to another G address', async () => {
    const horizon = server();
    const baseline = horizonAccount();
    horizon.loadAccount.mockResolvedValue(
      Object.assign(new Account(destinationAddress, '10'), {
        account_id: destinationAddress,
        thresholds: baseline.thresholds,
        signers: baseline.signers,
        balances: baseline.balances,
      }),
    );
    const gateway = new StellarPathPaymentSdkGateway(TEST_GATEWAY_CONFIG, horizon);
    await expect(
      gateway.buildPathPaymentStrictSend({
        source: sourceAddress,
        destination: destinationAddress,
        sendAsset: { kind: 'native' },
        sendAmount: '5',
        destinationAsset: { kind: 'credit', code: 'USD', issuer: issuerAddress },
        destinationMinimum: '9',
        path: [],
        baseFee: '100',
        expiresAtUnixSeconds: 1_782_000_180,
      }),
    ).rejects.toThrow('invalid_request');
  });

  it('rejects a signed envelope, multiple operations, op source override and wrong network at inspection', () => {
    const gateway = new StellarPathPaymentSdkGateway(TEST_GATEWAY_CONFIG, server());
    const pathOperation = () =>
      Operation.pathPaymentStrictSend({
        sendAsset: Asset.native(),
        sendAmount: '5',
        destination: destinationAddress,
        destAsset: new Asset('USDC', issuerAddress),
        destMin: '9',
        path: [],
      });
    const envelope = (operations: ReturnType<typeof pathOperation>[]) => {
      let builder = new TransactionBuilder(new Account(sourceAddress, '100'), {
        fee: '100',
        networkPassphrase: Networks.TESTNET,
      });
      for (const op of operations) builder = builder.addOperation(op);
      return builder.setTimebounds(0, 1_782_000_180).build();
    };
    const signed = envelope([pathOperation()]);
    signed.sign(Keypair.fromRawEd25519Seed(new Uint8Array(32).fill(21)));
    const multiple = envelope([pathOperation(), pathOperation()]);
    const override = envelope([
      Operation.pathPaymentStrictSend({
        sendAsset: Asset.native(),
        sendAmount: '5',
        destination: destinationAddress,
        destAsset: new Asset('USDC', issuerAddress),
        destMin: '9',
        path: [],
        source: destinationAddress,
      }),
    ]);
    for (const tx of [signed, multiple, override]) {
      expect(() =>
        gateway.inspectPathPaymentTransaction({
          transactionXdrBase64: tx.toXdr(),
          networkPassphrase: Networks.TESTNET,
        }),
      ).toThrow('path_payment_review_mismatch');
    }
    expect(() =>
      gateway.inspectPathPaymentTransaction({
        transactionXdrBase64: envelope([pathOperation()]).toXdr(),
        networkPassphrase: Networks.PUBLIC,
      }),
    ).toThrow('path_payment_review_mismatch');
  });

  it('rejects unreviewed extra transaction preconditions despite an otherwise valid Path Payment', () => {
    const gateway = new StellarPathPaymentSdkGateway(TEST_GATEWAY_CONFIG, server());
    const base = () =>
      new TransactionBuilder(new Account(sourceAddress, '100'), {
        fee: '100',
        networkPassphrase: Networks.TESTNET,
      }).addOperation(
        Operation.pathPaymentStrictSend({
          sendAsset: Asset.native(),
          sendAmount: '5',
          destination: destinationAddress,
          destAsset: new Asset('USDC', issuerAddress),
          destMin: '9',
          path: [],
        }),
      );
    const variants = [
      base().setLedgerbounds(1, 20),
      base().setMinAccountSequence('99'),
      base().setMinAccountSequenceAge(3n),
      base().setMinAccountSequenceLedgerGap(1),
      base().setExtraSigners([sourceAddress]),
    ];
    for (const builder of variants) {
      const tx = builder.setTimebounds(0, 1_782_000_180).build();
      expect(() =>
        gateway.inspectPathPaymentTransaction({
          transactionXdrBase64: tx.toXdr(),
          networkPassphrase: Networks.TESTNET,
        }),
      ).toThrow('path_payment_review_mismatch');
    }
  });

  it('rejects an invalid transaction timeout before loading the source account', async () => {
    const horizon = server();

    await expect(
      new StellarPathPaymentSdkGateway(TEST_GATEWAY_CONFIG, horizon).buildPathPaymentStrictSend({
        source: sourceAddress,
        destination: destinationAddress,
        sendAsset: { kind: 'native' },
        sendAmount: '1.0000000',
        destinationAsset: { kind: 'native' },
        destinationMinimum: '1.0000000',
        path: [],
        baseFee: '100',
        expiresAtUnixSeconds: 0,
      }),
    ).rejects.toThrow('invalid-path-payment-timebounds');
    expect(horizon.loadAccount).not.toHaveBeenCalled();
  });
});
