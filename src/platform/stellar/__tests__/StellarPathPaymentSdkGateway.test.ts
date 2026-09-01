import {Account, Asset, Networks, StrKey, Transaction} from '@stellar/stellar-sdk';

import {StellarPathPaymentSdkGateway} from '../StellarPathPaymentSdkGateway';
import type {
  HorizonAccountLike,
  HorizonPathServerLike,
} from '../types';

const sourceAddress = StrKey.encodeEd25519PublicKey(new Uint8Array(32).fill(11));
const destinationAddress = StrKey.encodeEd25519PublicKey(new Uint8Array(32).fill(12));
const issuerAddress = StrKey.encodeEd25519PublicKey(new Uint8Array(32).fill(13));

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
    loadStrictSendPaths: jest.fn().mockResolvedValue({records: []}),
    loadStrictReceivePaths: jest.fn().mockResolvedValue({records: []}),
  };
}

describe('StellarPathPaymentSdkGateway', () => {
  it('normalizes strict-send Horizon routes without choosing or reordering them', async () => {
    const horizon = server();
    horizon.loadStrictSendPaths.mockResolvedValue({
      records: [
        {
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
          source_amount: '1.0000000',
          destination_amount: '9.0000000',
          path: [{asset_type: 'native'}],
        },
      ],
    });
    const gateway = new StellarPathPaymentSdkGateway(horizon);

    await expect(
      gateway.loadStrictSendPaths({
        sourceAsset: {kind: 'native'},
        sourceAmount: '1.0000000',
        destinationAssets: [
          {kind: 'credit', code: 'usd', issuer: issuerAddress},
        ],
      }),
    ).resolves.toEqual([
      {
        sourceAmount: '1.0000000',
        destinationAmount: '2.0000000',
        path: [{kind: 'credit', code: 'usd', issuer: issuerAddress}],
      },
      {
        sourceAmount: '1.0000000',
        destinationAmount: '9.0000000',
        path: [{kind: 'native'}],
      },
    ]);

    const call = horizon.loadStrictSendPaths.mock.calls[0][0];
    expect(call.sourceAsset.isNative()).toBe(true);
    expect(call.sourceAmount).toBe('1.0000000');
    expect(call.destinationAssets).toHaveLength(1);
    expect(call.destinationAssets[0].getCode()).toBe('usd');
    expect(call.destinationAssets[0].getIssuer()).toBe(issuerAddress);
  });

  it('normalizes strict-receive Horizon routes with exact source and destination amounts', async () => {
    const horizon = server();
    horizon.loadStrictReceivePaths.mockResolvedValue({
      records: [
        {
          source_amount: '3.1234567',
          destination_amount: '1.0000000',
          path: [],
        },
      ],
    });
    const gateway = new StellarPathPaymentSdkGateway(horizon);

    await expect(
      gateway.loadStrictReceivePaths({
        sourceAssets: [{kind: 'native'}],
        destinationAsset: {kind: 'credit', code: 'usd', issuer: issuerAddress},
        destinationAmount: '1.0000000',
      }),
    ).resolves.toEqual([
      {
        sourceAmount: '3.1234567',
        destinationAmount: '1.0000000',
        path: [],
      },
    ]);

    const call = horizon.loadStrictReceivePaths.mock.calls[0][0];
    expect(call.sourceAssets[0].isNative()).toBe(true);
    expect(call.destinationAsset.getCode()).toBe('usd');
    expect(call.destinationAsset.getIssuer()).toBe(issuerAddress);
    expect(call.destinationAmount).toBe('1.0000000');
  });

  it('fails closed on malformed Horizon path assets', async () => {
    const horizon = server();
    horizon.loadStrictSendPaths.mockResolvedValue({
      records: [
        {
          source_amount: '1.0000000',
          destination_amount: '2.0000000',
          path: [{asset_type: 'credit_alphanum4', asset_code: 'usd'}],
        },
      ],
    });

    await expect(
      new StellarPathPaymentSdkGateway(horizon).loadStrictSendPaths({
        sourceAsset: {kind: 'native'},
        sourceAmount: '1.0000000',
        destinationAssets: [
          {kind: 'credit', code: 'usd', issuer: issuerAddress},
        ],
      }),
    ).rejects.toThrow('invalid-horizon-path-asset:credit_alphanum4');
  });

  it('builds strict-send XDR from caller-provided path, protection amount, fee and timeout', async () => {
    const horizon = server();
    const built = await new StellarPathPaymentSdkGateway(horizon).buildPathPaymentStrictSend({
      source: sourceAddress,
      destination: destinationAddress,
      sendAsset: {kind: 'native'},
      sendAmount: '4.0000000',
      destinationAsset: {kind: 'credit', code: 'usd', issuer: issuerAddress},
      destinationMinimum: '7.5000000',
      path: [{kind: 'credit', code: 'eur', issuer: issuerAddress}],
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
    const built = await new StellarPathPaymentSdkGateway(horizon).buildPathPaymentStrictReceive({
      source: sourceAddress,
      destination: destinationAddress,
      sendAsset: {kind: 'credit', code: 'eur', issuer: issuerAddress},
      sendMaximum: '8.5000000',
      destinationAsset: {kind: 'native'},
      destinationAmount: '5.0000000',
      path: [{kind: 'credit', code: 'usd', issuer: issuerAddress}],
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
      new StellarPathPaymentSdkGateway(horizon).buildPathPaymentStrictSend({
        source: sourceAddress,
        destination: destinationAddress,
        sendAsset: {kind: 'native'},
        sendAmount: '1.0000000',
        destinationAsset: {kind: 'native'},
        destinationMinimum: '1.0000000',
        path: [],
        baseFee: '100',
        timeoutSeconds: 0,
      }),
    ).rejects.toThrow('invalid-path-payment-timeout');
    expect(horizon.loadAccount).not.toHaveBeenCalled();
  });
});
