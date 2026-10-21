import { Asset, Horizon, Memo, Operation, Transaction, TransactionBuilder } from '@stellar/stellar-sdk';

import type { NetworkContext } from '../../capabilities/network/types';
import type { PathPaymentTransactionProjection } from '../../capabilities/path-payment/types';
import type { StellarPathPaymentGateway } from './StellarGateway';
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

export type StellarPathPaymentSdkGatewayConfig = Readonly<{
  network: NetworkContext;
  horizonUrl: string;
}>;

function createDefaultServer(horizonUrl: string): PathPaymentServerLike {
  const server = new Horizon.Server(horizonUrl);

  return {
    loadAccount: address => server.loadAccount(address),
    loadStrictSendPaths: async input => {
      const response = await server
        .strictSendPaths(input.sourceAsset, input.sourceAmount, [...input.destinationAssets])
        .call();
      return {
        records: response.records as unknown as HorizonPathRecordLike[],
      };
    },
    loadStrictReceivePaths: async input => {
      const response = await server
        .strictReceivePaths([...input.sourceAssets], input.destinationAsset, input.destinationAmount)
        .call();
      return {
        records: response.records as unknown as HorizonPathRecordLike[],
      };
    },
  };
}

function toSdkAsset(asset: StellarPaymentAsset): Asset {
  return asset.kind === 'native' ? Asset.native() : new Asset(asset.code, asset.issuer);
}

function mapPathAsset(asset: HorizonPathAssetLike): StellarPaymentAsset {
  switch (asset.asset_type) {
    case 'native':
      return { kind: 'native' };
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
    sourceAsset: mapPathAsset({
      asset_type: record.source_asset_type,
      asset_code: record.source_asset_code,
      asset_issuer: record.source_asset_issuer,
    }),
    destinationAsset: mapPathAsset({
      asset_type: record.destination_asset_type,
      asset_code: record.destination_asset_code,
      asset_issuer: record.destination_asset_issuer,
    }),
    path: record.path.map(mapPathAsset),
  };
}

function validateExpiration(expiresAtUnixSeconds: number): void {
  if (!Number.isSafeInteger(expiresAtUnixSeconds) || expiresAtUnixSeconds <= 0) {
    throw new Error('invalid-path-payment-timebounds');
  }
}

function toSdkMemo(memo: NonNullable<BuildPathPaymentStrictSendInput['memo']>): Memo {
  switch (memo.type) {
    case 'text':
      return Memo.text(memo.value);
    case 'id':
      return Memo.id(memo.value);
    case 'hash':
      return Memo.hash(memo.value);
  }
}

function toPaymentAsset(asset: Asset): StellarPaymentAsset {
  return asset.isNative() ? { kind: 'native' } : { kind: 'credit', code: asset.code, issuer: asset.issuer! };
}

function decodeTextMemo(value: Uint8Array): string {
  try {
    return decodeURIComponent(
      Array.from(value)
        .map(byte => '%' + byte.toString(16).padStart(2, '0'))
        .join(''),
    );
  } catch {
    throw new Error('path_payment_review_mismatch');
  }
}

export class StellarPathPaymentSdkGateway implements StellarPathPaymentGateway {
  private readonly server: PathPaymentServerLike;

  constructor(
    private readonly config: StellarPathPaymentSdkGatewayConfig,
    server?: PathPaymentServerLike,
  ) {
    this.server = server ?? createDefaultServer(config.horizonUrl);
  }

  get network(): NetworkContext {
    return this.config.network;
  }

  async loadStrictSendPaths(input: LoadStrictSendPathsInput): Promise<readonly StellarPathPaymentRoute[]> {
    const page = await this.server.loadStrictSendPaths({
      sourceAsset: toSdkAsset(input.sourceAsset),
      sourceAmount: input.sourceAmount,
      destinationAssets: input.destinationAssets.map(toSdkAsset),
    });
    return page.records.map(mapPathRecord);
  }

  async loadStrictReceivePaths(input: LoadStrictReceivePathsInput): Promise<readonly StellarPathPaymentRoute[]> {
    const page = await this.server.loadStrictReceivePaths({
      sourceAssets: input.sourceAssets.map(toSdkAsset),
      destinationAsset: toSdkAsset(input.destinationAsset),
      destinationAmount: input.destinationAmount,
    });
    return page.records.map(mapPathRecord);
  }

  async buildPathPaymentStrictSend(input: BuildPathPaymentStrictSendInput): Promise<BuiltTransaction> {
    validateExpiration(input.expiresAtUnixSeconds);
    const sourceAccount = await this.server.loadAccount(input.source);
    if (sourceAccount.accountId() !== input.source) {
      throw new Error('invalid_request');
    }
    let builder = new TransactionBuilder(sourceAccount, {
      fee: input.baseFee,
      networkPassphrase: this.config.network.networkPassphrase,
    }).addOperation(
      Operation.pathPaymentStrictSend({
        sendAsset: toSdkAsset(input.sendAsset),
        sendAmount: input.sendAmount,
        destination: input.destination,
        destAsset: toSdkAsset(input.destinationAsset),
        destMin: input.destinationMinimum,
        path: input.path.map(toSdkAsset),
      }),
    );
    if (input.memo !== undefined) builder = builder.addMemo(toSdkMemo(input.memo));
    const transaction = builder.setTimebounds(0, input.expiresAtUnixSeconds).build();
    return {
      source: input.source,
      networkId: this.config.network.id,
      transactionXdrBase64: transaction.toXdr(),
    };
  }

  async buildPathPaymentStrictReceive(input: BuildPathPaymentStrictReceiveInput): Promise<BuiltTransaction> {
    validateExpiration(input.expiresAtUnixSeconds);
    const sourceAccount = await this.server.loadAccount(input.source);
    if (sourceAccount.accountId() !== input.source) {
      throw new Error('invalid_request');
    }
    let builder = new TransactionBuilder(sourceAccount, {
      fee: input.baseFee,
      networkPassphrase: this.config.network.networkPassphrase,
    }).addOperation(
      Operation.pathPaymentStrictReceive({
        sendAsset: toSdkAsset(input.sendAsset),
        sendMax: input.sendMaximum,
        destination: input.destination,
        destAsset: toSdkAsset(input.destinationAsset),
        destAmount: input.destinationAmount,
        path: input.path.map(toSdkAsset),
      }),
    );
    if (input.memo !== undefined) builder = builder.addMemo(toSdkMemo(input.memo));
    const transaction = builder.setTimebounds(0, input.expiresAtUnixSeconds).build();
    return {
      source: input.source,
      networkId: this.config.network.id,
      transactionXdrBase64: transaction.toXdr(),
    };
  }

  // Independent XDR decode, not a copy of the caller-provided build DTO.
  inspectPathPaymentTransaction(
    input: Readonly<{
      transactionXdrBase64: string;
      networkPassphrase: string;
    }>,
  ): PathPaymentTransactionProjection {
    try {
      if (input.networkPassphrase !== this.config.network.networkPassphrase) {
        throw new Error('network mismatch');
      }
      const transaction = new Transaction(input.transactionXdrBase64, input.networkPassphrase);
      if (
        transaction.operations.length !== 1 ||
        transaction.signatures.length !== 0 ||
        !transaction.timeBounds ||
        transaction.timeBounds.minTime !== '0' ||
        transaction.ledgerBounds !== undefined ||
        transaction.minAccountSequence !== undefined ||
        transaction.minAccountSequenceAge !== undefined ||
        transaction.minAccountSequenceLedgerGap !== undefined ||
        transaction.extraSigners !== undefined
      ) {
        throw new Error('unsafe envelope');
      }
      const op = transaction.operations[0];
      if ((op.type !== 'pathPaymentStrictSend' && op.type !== 'pathPaymentStrictReceive') || op.source) {
        throw new Error('wrong operation');
      }
      const expiresAtUnixSeconds = Number(transaction.timeBounds.maxTime);
      if (!Number.isSafeInteger(expiresAtUnixSeconds) || expiresAtUnixSeconds <= 0) {
        throw new Error('invalid timebounds');
      }
      let memo: PathPaymentTransactionProjection['memo'];
      const txMemo = transaction.memo;
      if (txMemo.type === 'text') memo = { type: 'text', value: decodeTextMemo(txMemo.value as Uint8Array) };
      else if (txMemo.type === 'id') memo = { type: 'id', value: String(txMemo.value) };
      else if (txMemo.type === 'hash') {
        memo = {
          type: 'hash',
          value: Array.from(txMemo.value as Uint8Array)
            .map(byte => byte.toString(16).padStart(2, '0'))
            .join(''),
        };
      } else if (txMemo.type !== 'none') {
        throw new Error('unsupported memo');
      }
      const base = {
        source: transaction.source,
        destination: op.destination,
        sourceAsset: toPaymentAsset(op.sendAsset),
        destinationAsset: toPaymentAsset(op.destAsset),
        path: Object.freeze(op.path.map(toPaymentAsset)),
        ...(memo === undefined ? {} : { memo: Object.freeze(memo) }),
        fee: transaction.fee,
        minTimeUnixSeconds: 0,
        expiresAtUnixSeconds,
      };
      return Object.freeze(
        op.type === 'pathPaymentStrictSend'
          ? {
              ...base,
              mode: 'strict_send' as const,
              sendAmount: op.sendAmount,
              destinationMinimum: op.destMin,
            }
          : {
              ...base,
              mode: 'strict_receive' as const,
              sendMaximum: op.sendMax,
              destinationAmount: op.destAmount,
            },
      );
    } catch {
      throw new Error('path_payment_review_mismatch');
    }
  }
}
