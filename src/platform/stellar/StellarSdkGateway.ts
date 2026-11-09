import { readHistoryOperationEffects } from './HistoryEffectsProjection';
import {
  Address,
  xdr,
  Asset,
  Horizon,
  Memo,
  Operation,
  StrKey,
  Transaction,
  TransactionBuilder,
} from '@stellar/stellar-sdk/axios';

import { validClaimableId } from '../../capabilities/claimable/records';
import type { ClaimableTransactionProjection } from '../../capabilities/claimable/claimableTransaction';
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

export function mapHistoryOperationRecord(input: HorizonOperationLike): HistoryOperationRecord {
  const asset =
    input.type === 'create_claimable_balance'
      ? canonicalHistoryAsset(input.asset)
      : mapHistoryAsset(input.asset_type, input.asset_code, input.asset_issuer);
  const sourceAsset = mapHistoryAsset(input.source_asset_type, input.source_asset_code, input.source_asset_issuer);

  return Object.freeze({
    id: input.id,
    pagingToken: input.paging_token,
    type: input.type,
    occurredAt: input.created_at,
    transactionHash: input.transaction_hash,
    sourceAccount: input.source_account,
    ...(typeof input.transaction_successful === 'boolean'
      ? { successful: input.transaction_successful }
      : { outcomeUnknown: true as const }),
    ...mapOfferPoolFields(input),
    ...mapContractFields(input),
    ...mapClassicControlFields(input),
    ...(input.authorize === undefined ? {} : { authorize: input.authorize }),
    ...(input.authorize_to_maintain_liabilities === undefined
      ? {}
      : { authorizeToMaintainLiabilities: input.authorize_to_maintain_liabilities }),
    ...(input.set_flags === undefined ? {} : { setFlags: input.set_flags }),
    ...(input.clear_flags === undefined ? {} : { clearFlags: input.clear_flags }),
    ...(input.sponsored_id === undefined ? {} : { sponsoredId: input.sponsored_id }),
    ...(input.begin_sponsor === undefined ? {} : { beginSponsor: input.begin_sponsor }),
    ...(input.extend_to === undefined ? {} : { extendTo: input.extend_to }),
    ...(input.bump_to === undefined ? {} : { bumpTo: input.bump_to }),
    ...(input.type !== 'manage_data' || input.name === undefined ? {} : { dataName: input.name }),
    ...(input.claimants === undefined ? {} : { claimants: input.claimants }),
    ...(input.claimant === undefined ? {} : { claimant: input.claimant }),
    ...(input.balance_id === undefined ? {} : { balanceId: input.balance_id }),
    ...(typeof input.source_amount === 'string' ? { sourceAmount: input.source_amount } : {}),
    ...(sourceAsset === undefined ? {} : { sourceAsset }),
    ...(input.from_muxed === undefined ? {} : { fromMuxed: input.from_muxed }),
    ...(input.from === undefined ? {} : { from: input.from }),
    ...(input.to === undefined ? {} : { to: input.to }),
    ...(input.to_muxed === undefined ? {} : { toMuxed: input.to_muxed }),
    ...(input.amount === undefined ? {} : { amount: input.amount }),
    ...(asset === undefined ? {} : { asset: Object.freeze(asset) }),
    ...(input.funder === undefined ? {} : { funder: input.funder }),
    ...(input.account === undefined ? {} : { account: input.account }),
    ...(input.starting_balance === undefined ? {} : { startingBalance: input.starting_balance }),
    ...(input.trustor === undefined ? {} : { trustor: input.trustor }),
    ...(input.trustee === undefined ? {} : { trustee: input.trustee }),
    ...(input.limit === undefined ? {} : { limit: input.limit }),
  });
}

function mapContractFields(input: HorizonOperationLike): Partial<HistoryOperationRecord> {
  if (input.type !== 'invoke_host_function') return {};
  let contractId: string | undefined;
  let functionName: string | undefined;
  try {
    if (input.function === 'HostFunctionTypeHostFunctionTypeInvokeContract') {
      if (!Array.isArray(input.parameters) || input.parameters.length < 2 || input.parameters.length > 128)
        throw new Error('invalid-contract-parameters');
      const parameters = input.parameters;
      const decode = (index: number, type: string) => {
        const parameter = parameters[index] as Record<string, unknown>;
        if (
          !parameter ||
          parameter.type !== type ||
          typeof parameter.value !== 'string' ||
          parameter.value.length > 512
        )
          throw new Error('invalid-contract-parameter');
        const value = xdr.ScVal.fromXDR(parameter.value, 'base64');
        if (value.toXDR('base64') !== parameter.value) throw new Error('noncanonical-contract-parameter');
        return value;
      };
      const address = decode(0, 'Address');
      const symbol = decode(1, 'Sym');
      if (address.type !== 'scvAddress' || symbol.type !== 'scvSymbol') throw new Error('invalid-contract-identity');
      contractId = Address.fromScVal(address).toString();
      functionName = symbol.sym.toString();
    }
    if (
      contractId !== undefined &&
      (!StrKey.isValidContract(contractId) || new Address(contractId).toString() !== contractId)
    )
      contractId = undefined;
  } catch {
    contractId = undefined;
    functionName = undefined;
  }
  const raw = input.asset_balance_changes;
  const events =
    Array.isArray(raw) && raw.length <= 128
      ? raw.map(value => {
          if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
          const event = value as Record<string, unknown>;
          return {
            type: event.type,
            amount: event.amount,
            asset: mapHistoryAsset(event.asset_type, event.asset_code, event.asset_issuer),
            ...(event.from === undefined ? {} : { from: event.from }),
            ...(event.to === undefined ? {} : { to: event.to }),
            ...(event.destination_muxed_id === undefined ? {} : { destinationMuxedId: event.destination_muxed_id }),
          };
        })
      : raw;
  return {
    hostFunction: input.function,
    ...(['HostFunctionTypeHostFunctionTypeCreateContract', 'HostFunctionTypeHostFunctionTypeCreateContractV2'].some(
      kind => kind === input.function,
    )
      ? {
          creationOrigin: input.from,
          ...(input.from === 'address' &&
          typeof input.address === 'string' &&
          (StrKey.isValidEd25519PublicKey(input.address) || StrKey.isValidContract(input.address))
            ? { deployer: input.address }
            : {}),
          ...(input.from === 'asset' ? { creationAsset: canonicalHistoryAsset(input.asset) } : {}),
        }
      : {}),
    ...(contractId === undefined ? {} : { contractId }),
    ...(functionName === undefined ? {} : { functionName }),
    ...(events === undefined ? {} : { assetBalanceChanges: events }),
  };
}

function canonicalHistoryAsset(value: unknown): HistoryOperationRecord['asset'] {
  if (value === 'native') return Object.freeze({ kind: 'native' });
  if (typeof value !== 'string') return undefined;
  const parts = value.split(':');
  return parts.length === 2 ? Object.freeze({ kind: 'credit', code: parts[0], issuer: parts[1] }) : undefined;
}

function mapOfferPoolFields(input: HorizonOperationLike): Partial<HistoryOperationRecord> {
  const buyingAsset = mapHistoryAsset(input.buying_asset_type, input.buying_asset_code, input.buying_asset_issuer);
  const sellingAsset = mapHistoryAsset(input.selling_asset_type, input.selling_asset_code, input.selling_asset_issuer);
  const price = input.price_r;
  const rawReserves = input.type === 'liquidity_pool_deposit' ? input.reserves_deposited : input.reserves_received;
  const shares = input.type === 'liquidity_pool_deposit' ? input.shares_received : input.shares;
  const reserves =
    Array.isArray(rawReserves) && rawReserves.length === 2
      ? rawReserves.map(value => {
          if (!value || typeof value !== 'object') return undefined;
          const leg = value as Record<string, unknown>;
          if (typeof leg.asset !== 'string' || typeof leg.amount !== 'string') return undefined;
          const parts = leg.asset.split(':');
          const asset =
            leg.asset === 'native'
              ? { kind: 'native' as const }
              : parts.length === 2
                ? { kind: 'credit' as const, code: parts[0], issuer: parts[1] }
                : undefined;
          return asset ? Object.freeze({ asset: Object.freeze(asset), amount: leg.amount }) : undefined;
        })
      : undefined;
  return {
    ...(buyingAsset ? { buyingAsset } : {}),
    ...(sellingAsset ? { sellingAsset } : {}),
    ...(input.offer_id === undefined ? {} : { offerId: typeof input.offer_id === 'string' ? input.offer_id : '' }),
    ...(price &&
    typeof price === 'object' &&
    'n' in price &&
    'd' in price &&
    typeof price.n === 'number' &&
    typeof price.d === 'number'
      ? { price: Object.freeze({ n: price.n, d: price.d }) }
      : {}),
    ...(typeof input.liquidity_pool_id === 'string' ? { poolId: input.liquidity_pool_id } : {}),
    ...(reserves && reserves.every((leg): leg is NonNullable<typeof leg> => leg !== undefined)
      ? { reserves: Object.freeze(reserves) }
      : {}),
    ...(typeof shares === 'string' ? { shares } : {}),
  };
}

function mapHistoryAsset(type: unknown, code: unknown, issuer: unknown): HistoryOperationRecord['asset'] {
  if (type === undefined) return undefined;
  if (type === 'native') return Object.freeze({ kind: 'native' });
  if (type === 'credit_alphanum4' || type === 'credit_alphanum12') {
    return Object.freeze({
      kind: 'credit',
      ...(typeof code === 'string' ? { code } : {}),
      ...(typeof issuer === 'string' ? { issuer } : {}),
    });
  }
  return Object.freeze({ kind: 'unsupported' });
}

function createDefaultServer(horizonUrl: string, networkPassphrase: string): HorizonServerLike {
  const server = new Horizon.Server(horizonUrl);

  return {
    loadAccount: address => server.loadAccount(address),
    loadOperationEffects: async (operationId, cursor) => {
      let request = server.effects().forOperation(operationId).order('asc').limit(200);
      if (cursor !== undefined) request = request.cursor(cursor);
      return (await request.call()).records;
    },
    loadOperation: async operationId =>
      (await server.operations().operation(operationId).call()) as unknown as HorizonOperationLike,
    loadAccountOperations: async input => {
      let request = server.operations().forAccount(input.address).includeFailed(true).order('desc').limit(input.limit);
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

export function mapBalance(input: HorizonBalanceLike): StellarBalanceLine {
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
            balance.is_authorized_to_maintain_liabilities === undefined
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
            isClawbackEnabled: balance.is_clawback_enabled ?? false,
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

  get network(): NetworkContext {
    return this.config.network;
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

  async loadOperationEffects(input: { operationId: string; accountAddress: string; signal?: AbortSignal }) {
    if (!this.server.loadOperationEffects) return { operationId: input.operationId, complete: false, records: [] };
    return readHistoryOperationEffects(input.operationId, async cursor => {
      if (input.signal?.aborted) throw new Error('history-effects-aborted');
      const page = await this.server.loadOperationEffects!(input.operationId, cursor);
      if (input.signal?.aborted) throw new Error('history-effects-aborted');
      return page;
    });
  }
  async loadOperation(input: { operationId: string; accountAddress: string }) {
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
    let projectedMemo: PaymentTransactionProjection['memo'];
    if (memo.type === 'text') {
      projectedMemo = { type: 'text', value: decodeUtf8(memo.value as Uint8Array) };
    } else if (memo.type === 'id') {
      projectedMemo = { type: 'id', value: String(memo.value) };
    } else if (memo.type === 'hash' || memo.type === 'return') {
      projectedMemo = {
        type: memo.type,
        value: Array.from(memo.value as Uint8Array)
          .map(byte => byte.toString(16).padStart(2, '0'))
          .join(''),
      };
    } else if (memo.type !== 'none') {
      throw new Error('Payment review supports only none, text, id, hash, or return memo');
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
      ...(projectedMemo === undefined ? {} : { memo: Object.freeze(projectedMemo) }),
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

    if (input.memo !== undefined) {
      let memo: Memo;
      switch (input.memo.type) {
        case 'text':
          memo = Memo.text(input.memo.value);
          break;
        case 'id':
          memo = Memo.id(input.memo.value);
          break;
        case 'hash':
          memo = Memo.hash(input.memo.value);
          break;
        case 'return':
          memo = Memo.return(input.memo.value);
          break;
        default:
          throw new Error('unsupported-payment-memo-type');
      }
      builder = builder.addMemo(memo);
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

  inspectClaimClaimableBalance(xdrBase64: string, networkPassphrase: string): ClaimableTransactionProjection {
    if (networkPassphrase !== this.config.network.networkPassphrase)
      throw new Error('claimable-review-passphrase-mismatch');
    const transaction = new Transaction(xdrBase64, networkPassphrase);
    if (transaction.operations.length !== 1 || transaction.operations[0].type !== 'claimClaimableBalance')
      throw new Error('claimable-review-exact-operation-required');
    const operation = transaction.operations[0];
    if (operation.source || !validClaimableId(operation.balanceId))
      throw new Error('claimable-review-unexpected-source-or-id');
    if (transaction.memo.type !== 'none' || transaction.signatures.length > 0)
      throw new Error('claimable-review-unexpected-memo-or-signature');
    const maxTime = transaction.timeBounds?.maxTime;
    const expiresAtUnixSeconds = maxTime && maxTime !== '0' ? Number(maxTime) : undefined;
    if (!expiresAtUnixSeconds || !Number.isSafeInteger(expiresAtUnixSeconds))
      throw new Error('claimable-review-expiry-required');
    return Object.freeze({
      source: transaction.source,
      id: operation.balanceId,
      fee: transaction.fee,
      expiresAtUnixSeconds,
    });
  }

  async buildClaimClaimableBalance(source: string, id: string, baseFee: string): Promise<BuiltTransaction> {
    if (!this.isClassicAccountAddress(source) || !validClaimableId(id) || !/^\d+$/.test(baseFee) || Number(baseFee) < 1)
      throw new Error('claimable-build-invalid');
    const sourceAccount = await this.server.loadAccount(source);
    const transaction = new TransactionBuilder(sourceAccount, {
      fee: baseFee,
      networkPassphrase: this.config.network.networkPassphrase,
    })
      .addOperation(Operation.claimClaimableBalance({ balanceId: id }))
      .setTimeout(180)
      .build();
    return { source, networkId: this.config.network.id, transactionXdrBase64: transaction.toXdr() };
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

function mapClassicControlFields(input: HorizonOperationLike): Partial<HistoryOperationRecord> {
  if (!['account_merge', 'set_options', 'revoke_sponsorship', 'inflation'].includes(input.type)) return {};
  const keys = [
    'account',
    'into',
    'inflation_dest',
    'home_domain',
    'master_key_weight',
    'low_threshold',
    'med_threshold',
    'high_threshold',
    'signer_key',
    'signer_weight',
    'set_flags',
    'clear_flags',
    'account_id',
    'claimable_balance_id',
    'data_account_id',
    'data_name',
    'offer_id',
    'trustline_account_id',
    'trustline_asset',
    'trustline_liquidity_pool_id',
    'signer_account_id',
  ] as const;
  return {
    controlParameters: Object.fromEntries(keys.filter(key => input[key] !== undefined).map(key => [key, input[key]])),
  };
}
