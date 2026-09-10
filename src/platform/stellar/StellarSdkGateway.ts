import {Asset, Horizon, Memo, Operation, StrKey, Transaction, TransactionBuilder} from '@stellar/stellar-sdk/axios';

import type { HistoryOperationRecord } from '../../capabilities/history/HistoryGateway';
import type { NetworkContext } from '../../capabilities/network/types';
import type { PaymentTransactionProjection } from '../../capabilities/payment/PaymentGateway';
import type { TrustlineTransactionProjection } from '../../capabilities/trustline/TrustlineGateway';
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

export type StellarSdkGatewayConfig = Readonly<{
  network: NetworkContext;
  horizonUrl: string;
}>;

function mapHistoryOperationRecord(input: HorizonOperationLike): HistoryOperationRecord {
  const asset =
    input.asset_type === undefined
      ? undefined
      : input.asset_type === 'native'
        ? ({ kind: 'native' } as const)
        : input.asset_type === 'credit_alphanum4' || input.asset_type === 'credit_alphanum12'
          ? ({
              kind: 'credit',
              ...(input.asset_code === undefined ? {} : { code: input.asset_code }),
              ...(input.asset_issuer === undefined ? {} : { issuer: input.asset_issuer }),
            } as const)
          : ({ kind: 'unsupported' } as const);

  return Object.freeze({
    id: input.id,
    pagingToken: input.paging_token,
    type: input.type,
    occurredAt: input.created_at,
    transactionHash: input.transaction_hash,
    sourceAccount: input.source_account,
    ...(input.from === undefined ? {} : { from: input.from }),
    ...(input.to === undefined ? {} : { to: input.to }),
    ...(input.to_muxed === undefined ? {} : { toMuxed: input.to_muxed }),
    ...(input.amount === undefined ? {} : { amount: input.amount }),
    ...(asset === undefined ? {} : { asset: Object.freeze(asset) }),
    ...(input.funder === undefined ? {} : { funder: input.funder }),
    ...(input.account === undefined ? {} : { account: input.account }),
    ...(input.starting_balance === undefined ? {} : { startingBalance: input.starting_balance }),
  });
}

function createDefaultServer(horizonUrl: string, networkPassphrase: string): HorizonServerLike {
  const server = new Horizon.Server(horizonUrl);

  return {
    loadAccount: address => server.loadAccount(address),
    loadOperation: async operationId =>
      (await server.operations().operation(operationId).call()) as unknown as HorizonOperationLike,
    loadAccountOperations: async input => {
      let request = server.operations().forAccount(input.address).order('desc').limit(input.limit);
      if (input.cursor !== undefined) {
        request = request.cursor(input.cursor);
      }
      const page = await request.call();
      return { records: page.records as unknown as HorizonOperationLike[] };
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
        reserves: pool.reserves.map(reserve => ({ asset: reserve.asset })),
      };
    },
    loadTransaction: async transactionHash => {
      const transaction = await server.transactions().transaction(transactionHash).call();
      return {
        hash: transaction.hash,
        ledger: transaction.ledger_attr,
        successful: transaction.successful,
      };
    },
    submitTransaction: async signedXdrBase64 => {
      const transaction = new Transaction(signedXdrBase64, networkPassphrase);
      const result = await server.submitTransaction(transaction);
      return {
        hash: result.hash,
        ledger: result.ledger,
      };
    },
  };
}

function mapLedgerSigner(input: { key: string; weight: number; type: string }): LedgerSignerCondition {
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
      return { kind: 'native', balance: input.balance };
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
        ...(input.limit === undefined ? {} : { limit: input.limit }),
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
    memoRequired: account.data_attr?.['config.memo_required'] === 'MQ==',
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
            buyingLiabilities: balance.buying_liabilities ?? '0',
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
            ...(balance.limit === undefined ? {} : { limit: balance.limit }),
            buyingLiabilities: balance.buying_liabilities ?? '0',
            sellingLiabilities: balance.selling_liabilities ?? '0',
            code: balance.asset_code,
            issuer: balance.asset_issuer,
            isAuthorized: balance.is_authorized,
            isAuthorizedToMaintainLiabilities: balance.is_authorized_to_maintain_liabilities,
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
  const response = (error as { response?: unknown }).response;
  return response !== null && typeof response === 'object' && (response as { status?: unknown }).status === 404;
}

function transactionHashHex(transaction: Transaction): string {
  return Array.from(transaction.hash())
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

function deterministicSubmissionRejection(
  error: unknown,
): { rejected: false } | { rejected: true; resultCode?: string } {
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
  return typeof transactionCode === 'string' ? { rejected: true, resultCode: transactionCode } : { rejected: true };
}

function decodeUtf8(bytes: Uint8Array): string {
  const encoded = Array.from(bytes)
    .map(byte => `%${byte.toString(16).padStart(2, '0')}`)
    .join('');

  try {
    return decodeURIComponent(encoded);
  } catch {
    throw new Error('Payment review contains invalid UTF-8 text memo');
  }
}

export class StellarSdkGateway implements StellarGateway {
  private readonly server: HorizonServerLike;

  constructor(
    private readonly config: StellarSdkGatewayConfig,
    server?: HorizonServerLike,
  ) {
    this.server = server ?? createDefaultServer(config.horizonUrl, config.network.networkPassphrase);
  }

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
        return { status: 'inactive' as const, address };
      }
      throw error;
    }
  }

  async loadAccountState(address: string) {
    try {
      const account = await this.server.loadAccount(address);
      return { status: 'active' as const, account: mapAccountState(account) };
    } catch (error) {
      if (isHorizonNotFound(error)) {
        return { status: 'inactive' as const, address };
      }
      throw error;
    }
  }

  async loadOperation(input: { operationId: string }) {
    const operationId = input.operationId.trim();
    if (!operationId) {
      throw new Error('invalid-history-operation-id');
    }

    try {
      const operation = await this.server.loadOperation(operationId);
      return { status: 'found' as const, record: mapHistoryOperationRecord(operation) };
    } catch (error) {
      if (isHorizonNotFound(error)) {
        return { status: 'not-found' as const };
      }
      throw error;
    }
  }

  async loadAccountOperations(input: { address: string; cursor?: string; limit: number }) {
    if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 200) {
      throw new Error('invalid-horizon-operation-page-limit');
    }

    try {
      const page = await this.server.loadAccountOperations(input);
      const rawRecords = [...page.records];
      const lastRecord = rawRecords[rawRecords.length - 1];
      return {
        status: 'active' as const,
        address: input.address,
        records: rawRecords.map(mapHistoryOperationRecord),
        ...(rawRecords.length === input.limit && lastRecord ? { nextCursor: lastRecord.paging_token } : {}),
      };
    } catch (error) {
      if (isHorizonNotFound(error)) {
        return { status: 'inactive' as const, address: input.address };
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

  isClassicAccountAddress(address: string): boolean {
    return StrKey.isValidEd25519PublicKey(address);
  }

  inspectPaymentTransaction(
    input: Readonly<{
      transactionXdrBase64: string;
      networkPassphrase: string;
    }>,
  ): PaymentTransactionProjection {
    const transaction = new Transaction(input.transactionXdrBase64, input.networkPassphrase);
    if (transaction.operations.length !== 1) {
      throw new Error('Payment review requires exactly one operation');
    }

    const operation = transaction.operations[0];
    if (operation.type !== 'payment' && operation.type !== 'createAccount') {
      throw new Error('Payment review requires Payment or CreateAccount');
    }
    if (operation.source) {
      throw new Error('Payment review does not support an operation source override');
    }

    const asset =
      operation.type === 'createAccount'
        ? ({ kind: 'native' } as const)
        : operation.asset.isNative()
          ? ({ kind: 'native' } as const)
          : ({
              kind: 'credit',
              code: operation.asset.code,
              issuer: operation.asset.issuer!,
            } as const);
    const memo = transaction.memo;
    let memoText: string | undefined;
    if (memo.type === 'text') {
      memoText = decodeUtf8(memo.value as Uint8Array);
    } else if (memo.type !== 'none') {
      throw new Error('Payment review supports only none or text memo');
    }

    const maxTime = transaction.timeBounds?.maxTime;
    const expiresAtUnixSeconds = maxTime !== undefined && maxTime !== '0' ? Number(maxTime) : undefined;

    return Object.freeze({
      source: transaction.source,
      fee: transaction.fee,
      ...(expiresAtUnixSeconds === undefined ? {} : { expiresAtUnixSeconds }),
      operation: operation.type === 'createAccount' ? 'create-account' : 'payment',
      destination: operation.destination,
      amount: operation.type === 'createAccount' ? operation.startingBalance : operation.amount,
      asset: Object.freeze(asset),
      ...(memoText === undefined ? {} : { memo: memoText }),
    });
  }

  inspectTrustlineTransaction(
    input: Readonly<{
      transactionXdrBase64: string;
      networkPassphrase: string;
    }>,
  ): TrustlineTransactionProjection {
    const transaction = new Transaction(input.transactionXdrBase64, input.networkPassphrase);
    if (transaction.operations.length !== 1) {
      throw new Error('Trustline review requires exactly one operation');
    }

    const operation = transaction.operations[0];
    if (operation.type !== 'changeTrust') {
      throw new Error('Trustline review requires a ChangeTrust operation');
    }
    if (operation.source) {
      throw new Error('Trustline review does not support an operation source override');
    }
    if (!(operation.line instanceof Asset) || operation.line.isNative()) {
      throw new Error('Trustline review supports only ordinary issued assets');
    }

    const isRemove = operation.limit === '0.0000000' || operation.limit === '0';
    const maxTime = transaction.timeBounds?.maxTime;
    const expiresAtUnixSeconds = maxTime !== undefined && maxTime !== '0' ? Number(maxTime) : undefined;

    return Object.freeze({
      source: transaction.source,
      fee: transaction.fee,
      ...(expiresAtUnixSeconds === undefined ? {} : { expiresAtUnixSeconds }),
      asset: Object.freeze({ code: operation.line.code, issuer: operation.line.issuer! }),
      ...(isRemove ? {} : { limit: operation.limit }),
    });
  }

  async buildPayment(input: BuildPaymentInput): Promise<BuiltTransaction> {
    const sourceAccount = await this.server.loadAccount(input.source);
    const asset = input.asset.kind === 'native' ? Asset.native() : new Asset(input.asset.code, input.asset.issuer);

    if (input.operation === 'create-account' && input.asset.kind !== 'native') {
      throw new Error('create-account-requires-native-asset');
    }

    const operation =
      input.operation === 'create-account'
        ? Operation.createAccount({
            destination: input.destination,
            startingBalance: input.amount,
          })
        : Operation.payment({
            destination: input.destination,
            asset,
            amount: input.amount,
          });

    let builder = new TransactionBuilder(sourceAccount, {
      fee: input.baseFee,
      networkPassphrase: this.config.network.networkPassphrase,
    }).addOperation(operation);

    if (input.memo !== undefined && input.memo.length > 0) {
      builder = builder.addMemo(Memo.text(input.memo));
    }

    const transaction = builder.setTimeout(180).build();

    return {
      source: input.source,
      networkId: this.config.network.id,
      transactionXdrBase64: transaction.toXdr(),
    };
  }

  async buildChangeTrust(input: BuildChangeTrustInput): Promise<BuiltTransaction> {
    const sourceAccount = await this.server.loadAccount(input.source);
    const transaction = new TransactionBuilder(sourceAccount, {
      fee: input.baseFee,
      networkPassphrase: this.config.network.networkPassphrase,
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
      networkId: this.config.network.id,
      transactionXdrBase64: transaction.toXdr(),
    };
  }

  transactionHash(signedXdrBase64: string): string {
    return transactionHashHex(new Transaction(signedXdrBase64, this.config.network.networkPassphrase));
  }

  async loadTransactionOutcome(transactionHash: string) {
    try {
      const transaction = await this.server.loadTransaction(transactionHash);
      if (transaction.hash !== transactionHash) {
        throw new Error('horizon-transaction-hash-mismatch');
      }
      return transaction.successful
        ? {
            status: 'confirmed' as const,
            transactionHash,
            ledger: transaction.ledger,
          }
        : { status: 'rejected' as const, transactionHash };
    } catch (error) {
      if (isHorizonNotFound(error)) {
        return { status: 'still-unknown' as const, transactionHash };
      }
      throw error;
    }
  }

  async submitTransaction(signedXdrBase64: string): Promise<TransactionSubmissionResult> {
    const transactionHash = this.transactionHash(signedXdrBase64);

    try {
      const result = await this.server.submitTransaction(signedXdrBase64);
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
          ...(rejection.resultCode === undefined ? {} : { resultCode: rejection.resultCode }),
        };
      }

      return { status: 'uncertain', transactionHash };
    }
  }
}
