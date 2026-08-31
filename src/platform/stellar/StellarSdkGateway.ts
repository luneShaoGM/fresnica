import {
  Asset,
  Horizon,
  Memo,
  Operation,
  Transaction,
  TransactionBuilder,
} from '@stellar/stellar-sdk';

import { APP_CONFIG } from '../../app/config/appConfig';
import type { LedgerSignerCondition } from '../../capabilities/ledger-authorization/types';
import type { TransactionSubmissionResult } from '../../capabilities/transaction/submission';
import type { StellarGateway } from './StellarGateway';
import type {
  BuildPaymentInput,
  BuiltTransaction,
  HorizonBalanceLike,
  HorizonServerLike,
  StellarBalanceLine,
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

function mapLedgerSigner(input: {
  key: string;
  weight: number;
  type: string;
}): LedgerSignerCondition {
  switch (input.type) {
    case 'ed25519_public_key':
      return { kind: 'ed25519', publicKey: input.key, weight: input.weight };
    case 'preauth_tx':
      return { kind: 'preauth-tx', key: input.key, weight: input.weight };
    case 'sha256_hash':
      return { kind: 'hash-x', key: input.key, weight: input.weight };
    case 'ed25519_signed_payload':
      return { kind: 'signed-payload', key: input.key, weight: input.weight };
    default:
      throw new Error(`unsupported-ledger-signer-type:${input.type}`);
  }
}

function mapBalance(input: HorizonBalanceLike): StellarBalanceLine {
  switch (input.asset_type) {
    case 'native':
      return {kind: 'native', balance: input.balance};
    case 'credit_alphanum4':
    case 'credit_alphanum12':
      if (!input.asset_code || !input.asset_issuer) {
        throw new Error(`invalid-horizon-credit-balance:${input.asset_type}`);
      }
      return {
        kind: 'credit',
        balance: input.balance,
        code: input.asset_code,
        issuer: input.asset_issuer,
      };
    case 'liquidity_pool_shares':
      if (!input.liquidity_pool_id) {
        throw new Error('invalid-horizon-liquidity-pool-balance');
      }
      return {
        kind: 'liquidity-pool-share',
        balance: input.balance,
        liquidityPoolId: input.liquidity_pool_id,
      };
    default:
      throw new Error(`unsupported-horizon-balance-type:${input.asset_type}`);
  }
}

function isHorizonNotFound(error: unknown): boolean {
  if (error === null || typeof error !== 'object') {
    return false;
  }
  const response = (error as {response?: unknown}).response;
  return (
    response !== null &&
    typeof response === 'object' &&
    (response as {status?: unknown}).status === 404
  );
}

function transactionHashHex(transaction: Transaction): string {
  return Array.from(transaction.hash())
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

function deterministicSubmissionRejection(error: unknown):
  | { rejected: false }
  | { rejected: true; resultCode?: string } {
  if (error === null || typeof error !== 'object') {
    return { rejected: false };
  }

  const response = (error as { response?: unknown }).response;
  if (response === null || typeof response !== 'object') {
    return { rejected: false };
  }

  const status = (response as { status?: unknown }).status;
  if (status !== 400) {
    return { rejected: false };
  }

  const data = (response as { data?: unknown }).data;
  if (data === null || typeof data !== 'object') {
    return { rejected: true };
  }

  const extras = (data as { extras?: unknown }).extras;
  if (extras === null || typeof extras !== 'object') {
    return { rejected: true };
  }

  const resultCodes = (extras as { result_codes?: unknown }).result_codes;
  if (resultCodes === null || typeof resultCodes !== 'object') {
    return { rejected: true };
  }

  const transactionCode = (resultCodes as { transaction?: unknown }).transaction;
  return typeof transactionCode === 'string'
    ? { rejected: true, resultCode: transactionCode }
    : { rejected: true };
}

export class StellarSdkGateway implements StellarGateway {
  constructor(private readonly server: HorizonServerLike = createDefaultServer()) {}

  async loadAccountAuthorization(address: string) {
    const account = await this.server.loadAccount(address);

    return {
      address: account.account_id,
      thresholds: {
        low: account.thresholds.low_threshold,
        medium: account.thresholds.med_threshold,
        high: account.thresholds.high_threshold,
      },
      signers: account.signers.map(mapLedgerSigner),
    };
  }

  async loadAccountBalances(address: string) {
    try {
      const account = await this.server.loadAccount(address);
      return {
        status: 'active' as const,
        address: account.account_id,
        balances: account.balances.map(mapBalance),
      };
    } catch (error) {
      if (isHorizonNotFound(error)) {
        return {status: 'inactive' as const, address};
      }
      throw error;
    }
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
  ): Promise<TransactionSubmissionResult> {
    const transaction = new Transaction(
      signedXdrBase64,
      APP_CONFIG.network.networkPassphrase,
    );
    const transactionHash = transactionHashHex(transaction);

    try {
      const result = await this.server.submitTransaction(transaction);
      return {
        status: 'accepted',
        hash: result.hash,
        ...(result.ledger === undefined ? {} : { ledger: result.ledger }),
      };
    } catch (error) {
      const rejection = deterministicSubmissionRejection(error);
      if (rejection.rejected) {
        return {
          status: 'rejected',
          transactionHash,
          ...(rejection.resultCode === undefined
            ? {}
            : { resultCode: rejection.resultCode }),
        };
      }

      return { status: 'uncertain', transactionHash };
    }
  }
}
