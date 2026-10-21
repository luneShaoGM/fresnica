import { Account, Networks, StrKey, Transaction } from '@stellar/stellar-sdk';

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
      timeoutSeconds: 300,
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
      timeoutSeconds: 300,
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
        timeoutSeconds: 0,
      }),
    ).rejects.toThrow('invalid-path-payment-timeout');
    expect(horizon.loadAccount).not.toHaveBeenCalled();
  });
});
