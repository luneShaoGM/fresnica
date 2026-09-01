import {Asset, Horizon, Operation, TransactionBuilder} from '@stellar/stellar-sdk';

import {APP_CONFIG} from '../../app/config/appConfig';
import type {StellarPathPaymentGateway} from './StellarGateway';
import type {
  BuildPathPaymentStrictReceiveInput,
  BuildPathPaymentStrictSendInput,
  BuiltTransaction,
  HorizonAccountLike,
  HorizonPathAssetLike,
  HorizonPathRecordLike,
  HorizonPathServerLike,
  LoadStrictReceivePathsInput,
  LoadStrictSendPathsInput,
  StellarPathPaymentRoute,
  StellarPaymentAsset,
} from './types';

type PathPaymentServerLike = HorizonPathServerLike & {
  loadAccount(address: string): Promise<HorizonAccountLike>;
};

function createDefaultServer(): PathPaymentServerLike {
  const server = new Horizon.Server(APP_CONFIG.network.horizonUrl);

  return {
    loadAccount: address => server.loadAccount(address),
    loadStrictSendPaths: async input => {
      const response = await server
        .strictSendPaths(
          input.sourceAsset,
          input.sourceAmount,
          [...input.destinationAssets],
        )
        .call();
      return {
        records: response.records as unknown as HorizonPathRecordLike[],
      };
    },
    loadStrictReceivePaths: async input => {
      const response = await server
        .strictReceivePaths(
          [...input.sourceAssets],
          input.destinationAsset,
          input.destinationAmount,
        )
        .call();
      return {
        records: response.records as unknown as HorizonPathRecordLike[],
      };
    },
  };
}

function toSdkAsset(asset: StellarPaymentAsset): Asset {
  return asset.kind === 'native'
    ? Asset.native()
    : new Asset(asset.code, asset.issuer);
}

function mapPathAsset(asset: HorizonPathAssetLike): StellarPaymentAsset {
  switch (asset.asset_type) {
    case 'native':
      return {kind: 'native'};
    case 'credit_alphanum4':
    case 'credit_alphanum12':
      if (!asset.asset_code || !asset.asset_issuer) {
        throw new Error(`invalid-horizon-path-asset:${asset.asset_type}`);
      }
      return {
        kind: 'credit',
        code: asset.asset_code,
        issuer: asset.asset_issuer,
      };
    default:
      throw new Error(`unsupported-horizon-path-asset:${asset.asset_type}`);
  }
}

function mapPathRecord(record: HorizonPathRecordLike): StellarPathPaymentRoute {
  return {
    sourceAmount: record.source_amount,
    destinationAmount: record.destination_amount,
    path: record.path.map(mapPathAsset),
  };
}

function validateTimeoutSeconds(timeoutSeconds: number): void {
  if (!Number.isInteger(timeoutSeconds) || timeoutSeconds <= 0) {
    throw new Error('invalid-path-payment-timeout');
  }
}

export class StellarPathPaymentSdkGateway implements StellarPathPaymentGateway {
  constructor(private readonly server: PathPaymentServerLike = createDefaultServer()) {}

  async loadStrictSendPaths(
    input: LoadStrictSendPathsInput,
  ): Promise<readonly StellarPathPaymentRoute[]> {
    const page = await this.server.loadStrictSendPaths({
      sourceAsset: toSdkAsset(input.sourceAsset),
      sourceAmount: input.sourceAmount,
      destinationAssets: input.destinationAssets.map(toSdkAsset),
    });
    return page.records.map(mapPathRecord);
  }

  async loadStrictReceivePaths(
    input: LoadStrictReceivePathsInput,
  ): Promise<readonly StellarPathPaymentRoute[]> {
    const page = await this.server.loadStrictReceivePaths({
      sourceAssets: input.sourceAssets.map(toSdkAsset),
      destinationAsset: toSdkAsset(input.destinationAsset),
      destinationAmount: input.destinationAmount,
    });
    return page.records.map(mapPathRecord);
  }

  async buildPathPaymentStrictSend(
    input: BuildPathPaymentStrictSendInput,
  ): Promise<BuiltTransaction> {
    validateTimeoutSeconds(input.timeoutSeconds);
    const sourceAccount = await this.server.loadAccount(input.source);
    const transaction = new TransactionBuilder(sourceAccount, {
      fee: input.baseFee,
      networkPassphrase: APP_CONFIG.network.networkPassphrase,
    })
      .addOperation(
        Operation.pathPaymentStrictSend({
          sendAsset: toSdkAsset(input.sendAsset),
          sendAmount: input.sendAmount,
          destination: input.destination,
          destAsset: toSdkAsset(input.destinationAsset),
          destMin: input.destinationMinimum,
          path: input.path.map(toSdkAsset),
        }),
      )
      .setTimeout(input.timeoutSeconds)
      .build();

    return {
      source: input.source,
      networkId: APP_CONFIG.network.id,
      transactionXdrBase64: transaction.toXdr(),
    };
  }

  async buildPathPaymentStrictReceive(
    input: BuildPathPaymentStrictReceiveInput,
  ): Promise<BuiltTransaction> {
    validateTimeoutSeconds(input.timeoutSeconds);
    const sourceAccount = await this.server.loadAccount(input.source);
    const transaction = new TransactionBuilder(sourceAccount, {
      fee: input.baseFee,
      networkPassphrase: APP_CONFIG.network.networkPassphrase,
    })
      .addOperation(
        Operation.pathPaymentStrictReceive({
          sendAsset: toSdkAsset(input.sendAsset),
          sendMax: input.sendMaximum,
          destination: input.destination,
          destAsset: toSdkAsset(input.destinationAsset),
          destAmount: input.destinationAmount,
          path: input.path.map(toSdkAsset),
        }),
      )
      .setTimeout(input.timeoutSeconds)
      .build();

    return {
      source: input.source,
      networkId: APP_CONFIG.network.id,
      transactionXdrBase64: transaction.toXdr(),
    };
  }
}
