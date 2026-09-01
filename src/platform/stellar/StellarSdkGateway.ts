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
  BuildChangeTrustInput,
  BuildPaymentInput,
  BuiltTransaction,
  HorizonAccountLike,
  HorizonBalanceLike,
  HorizonOperationLike,
  HorizonServerLike,
  StellarAccountState,
  StellarBalanceLine,
} from './types';

function createDefaultServer(): HorizonServerLike {
  const server = new Horizon.Server(APP_CONFIG.network.horizonUrl);

  return {
    loadAccount: address => server.loadAccount(address),
    loadAccountOperations: async input => {
      let request = server
        .operations()
        .forAccount(input.address)
        .order('desc')
        .limit(input.limit);
      if (input.cursor !== undefined) {
        request = request.cursor(input.cursor);
      }
      const page = await request.call();
      return {records: page.records as unknown as HorizonOperationLike[]};
    },
    loadLedgerParameters: async () => {
      const page = await server.ledgers().order('desc').limit(1).call();
      const ledger = page.records[0];
      if (!ledger) {
        throw new Error('horizon-returned-no-ledger');
      }
      return {
        base_fee_in_stroops: ledger.base_fee_in_stroops,
        base_reserve_in_stroops: ledger.base_reserve_in_stroops,
      };
    },
    loadLiquidityPool: async id => {
      const pool = await server.liquidityPools().liquidityPoolId(id).call();
      return {
        id: pool.id,
        reserves: pool.reserves.map(reserve => ({asset: reserve.asset})),
      };
    },
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

function mapAccountState(account: HorizonAccountLike): StellarAccountState {
  if (
    !Number.isInteger(account.subentry_count) ||
    !Number.isInteger(account.num_sponsoring) ||
    !Number.isInteger(account.num_sponsored) ||
    account.flags?.auth_required === undefined ||
    account.flags.auth_clawback_enabled === undefined
  ) {
    throw new Error('invalid-horizon-account-state');
  }

  return {
    address: account.account_id,
    subentryCount: account.subentry_count!,
    numSponsoring: account.num_sponsoring!,
    numSponsored: account.num_sponsored!,
    flags: {
      authRequired: account.flags.auth_required,
      authClawbackEnabled: account.flags.auth_clawback_enabled,
    },
    balances: account.balances.map(balance => {
      switch (balance.asset_type) {
        case 'native':
          return {
            kind: 'native' as const,
            balance: balance.balance,
            sellingLiabilities: balance.selling_liabilities ?? '0',
          };
        case 'credit_alphanum4':
        case 'credit_alphanum12':
          if (
            !balance.asset_code ||
            !balance.asset_issuer ||
            balance.is_authorized === undefined ||
            balance.is_authorized_to_maintain_liabilities === undefined ||
            balance.is_clawback_enabled === undefined
          ) {
            throw new Error(`invalid-horizon-trustline-balance:${balance.asset_type}`);
          }
          return {
            kind: 'credit' as const,
            balance: balance.balance,
            buyingLiabilities: balance.buying_liabilities ?? '0',
            sellingLiabilities: balance.selling_liabilities ?? '0',
            code: balance.asset_code,
            issuer: balance.asset_issuer,
            isAuthorized: balance.is_authorized,
            isAuthorizedToMaintainLiabilities:
              balance.is_authorized_to_maintain_liabilities,
            isClawbackEnabled: balance.is_clawback_enabled,
          };
        case 'liquidity_pool_shares':
          if (!balance.liquidity_pool_id) {
            throw new Error('invalid-horizon-liquidity-pool-balance');
          }
          return {
            kind: 'liquidity-pool-share' as const,
            balance: balance.balance,
            liquidityPoolId: balance.liquidity_pool_id,
          };
        default:
          throw new Error(`unsupported-horizon-balance-type:${balance.asset_type}`);
      }
    }),
  };
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

  async loadAccountState(address: string) {
    try {
      const account = await this.server.loadAccount(address);
      return {status: 'active' as const, account: mapAccountState(account)};
    } catch (error) {
      if (isHorizonNotFound(error)) {
        return {status: 'inactive' as const, address};
      }
      throw error;
    }
  }

  async loadAccountOperations(input: {
    address: string;
    cursor?: string;
    limit: number;
  }) {
    if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 200) {
      throw new Error('invalid-horizon-operation-page-limit');
    }

    try {
      const page = await this.server.loadAccountOperations(input);
      const records = [...page.records];
      const lastRecord = records[records.length - 1];
      return {
        status: 'active' as const,
        address: input.address,
        records,
        ...(records.length === input.limit && lastRecord
          ? {nextCursor: lastRecord.paging_token}
          : {}),
      };
    } catch (error) {
      if (isHorizonNotFound(error)) {
        return {status: 'inactive' as const, address: input.address};
      }
      throw error;
    }
  }

  async loadLedgerParameters() {
    const parameters = await this.server.loadLedgerParameters();
    return {
      baseFeeStroops: parameters.base_fee_in_stroops,
      baseReserveStroops: parameters.base_reserve_in_stroops,
    };
  }

  async loadLiquidityPool(id: string) {
    const pool = await this.server.loadLiquidityPool(id);
    return {
      id: pool.id,
      reserveAssets: pool.reserves.map(reserve => reserve.asset),
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

  async buildChangeTrust(input: BuildChangeTrustInput): Promise<BuiltTransaction> {
    const sourceAccount = await this.server.loadAccount(input.source);
    const transaction = new TransactionBuilder(sourceAccount, {
      fee: input.baseFee,
      networkPassphrase: APP_CONFIG.network.networkPassphrase,
    })
      .addOperation(
        Operation.changeTrust({
          asset: new Asset(input.code, input.issuer),
          limit: input.limit,
        }),
      )
      .setTimeout(180)
      .build();

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
