import {
  Asset,
  Horizon,
  Memo,
  Operation,
  Transaction,
  TransactionBuilder,
} from '@stellar/stellar-sdk';

import { APP_CONFIG } from '../../../app/config/appConfig';
import type { StellarAccountAuthorization } from '../accounts/types';
import type { StellarGateway } from './StellarGateway';
import type {
  BuildPaymentInput,
  BuiltTransaction,
  HorizonServerLike,
  SubmittedTransaction,
} from './types';

function createDefaultServer(): HorizonServerLike {
  const server = new Horizon.Server(APP_CONFIG.network.horizonUrl);

  return {
    loadAccount: address => server.loadAccount(address),
    submitTransaction: async transaction => {
      const result = await server.submitTransaction(transaction);
      return {
        hash: result.hash,
        ledger: result.ledger,
      };
    },
  };
}

export class StellarSdkGateway implements StellarGateway {
  constructor(private readonly server: HorizonServerLike = createDefaultServer()) {}

  async loadAccountAuthorization(
    address: string,
  ): Promise<StellarAccountAuthorization> {
    const account = await this.server.loadAccount(address);

    return {
      address: account.account_id,
      thresholds: {
        low: account.thresholds.low_threshold,
        medium: account.thresholds.med_threshold,
        high: account.thresholds.high_threshold,
      },
      signers: account.signers.map(signer => ({
        publicKey: signer.key,
        weight: signer.weight,
      })),
    };
  }

  async buildPayment(input: BuildPaymentInput): Promise<BuiltTransaction> {
    const sourceAccount = await this.server.loadAccount(input.source);
    const asset =
      input.asset.kind === 'native'
        ? Asset.native()
        : new Asset(input.asset.code, input.asset.issuer);

    let builder = new TransactionBuilder(sourceAccount, {
      fee: input.baseFee,
      networkPassphrase: APP_CONFIG.network.networkPassphrase,
    }).addOperation(
      Operation.payment({
        destination: input.destination,
        asset,
        amount: input.amount,
      }),
    );

    if (input.memo !== undefined && input.memo.length > 0) {
      builder = builder.addMemo(Memo.text(input.memo));
    }

    const transaction = builder.setTimeout(180).build();

    return {
      source: input.source,
      networkId: APP_CONFIG.network.id,
      transactionXdrBase64: transaction.toXdr(),
    };
  }

  async submitTransaction(
    signedXdrBase64: string,
  ): Promise<SubmittedTransaction> {
    const transaction = new Transaction(
      signedXdrBase64,
      APP_CONFIG.network.networkPassphrase,
    );
    const result = await this.server.submitTransaction(transaction);

    return {
      hash: result.hash,
      ...(result.ledger === undefined ? {} : { ledger: result.ledger }),
    };
  }
}
