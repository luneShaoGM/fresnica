import {
  Asset,
  Horizon,
  LiquidityPoolAsset,
  Operation,
  StrKey,
  Transaction,
  TransactionBuilder,
  getLiquidityPoolId,
  xdr,
} from '@stellar/stellar-sdk/axios';
import type {
  MarketGateway,
  Asset as MarketAsset,
  EncodedMarketOperation,
  MarketOperation,
  Offer,
  Pool,
  Price,
} from '../../capabilities/markets/types';
import type { NetworkContext } from '../../capabilities/network/types';
import type { StellarGateway } from './StellarGateway';
import { stroops } from '../../capabilities/stellar/classicAmounts';
import { object } from './horizonReadHttp';

function text(value: unknown): string {
  if (typeof value !== 'string' || value.length > 256) throw new Error('market_invalid_response');
  return value;
}
function numeric(value: unknown): string {
  const result = text(value);
  stroops(result);
  return result;
}
function toAsset(asset: MarketAsset): Asset {
  return asset.kind === 'native' ? Asset.native() : new Asset(asset.code, asset.issuer);
}
function fromAsset(asset: Asset): MarketAsset {
  return asset.isNative() ? { kind: 'native' } : { kind: 'credit', code: asset.code, issuer: asset.issuer! };
}
function canonicalAsset(value: unknown): MarketAsset {
  const id = text(value);
  if (id === 'native') return { kind: 'native' };
  const [code, issuer, extra] = id.split(':');
  if (extra !== undefined || !/^[A-Za-z0-9]{1,12}$/.test(code) || !StrKey.isValidEd25519PublicKey(issuer ?? ''))
    throw new Error('market_invalid_asset');
  return { kind: 'credit', code, issuer };
}
function recordAsset(value: unknown): MarketAsset {
  const raw = object(value);
  if (raw.asset_type === 'native') return { kind: 'native' };
  if (raw.asset_type !== 'credit_alphanum4' && raw.asset_type !== 'credit_alphanum12')
    throw new Error('market_invalid_asset');
  return canonicalAsset(`${text(raw.asset_code)}:${text(raw.asset_issuer)}`);
}
function ratio(value: unknown): Price {
  const raw = object(value);
  if (![raw.n, raw.d].every(v => typeof v === 'number' && Number.isInteger(v) && v > 0 && v <= 2147483647))
    throw new Error('market_invalid_price');
  return { n: raw.n as number, d: raw.d as number };
}
function offer(value: unknown): Offer {
  const raw = object(value);
  const id = text(raw.id),
    seller = text(raw.seller);
  if (!/^[1-9]\d{0,18}$/.test(id) || !StrKey.isValidEd25519PublicKey(seller)) throw new Error('market_invalid_offer');
  return {
    id,
    seller,
    selling: recordAsset(raw.selling),
    buying: recordAsset(raw.buying),
    amount: numeric(raw.amount),
    price: ratio(raw.price_r),
  };
}
function poolAsset(pool: Pick<Pool, 'assetA' | 'assetB' | 'protocolFee'>) {
  return new LiquidityPoolAsset(toAsset(pool.assetA), toAsset(pool.assetB), pool.protocolFee);
}
function poolId(line: LiquidityPoolAsset): string {
  return Array.from(getLiquidityPoolId('constant_product', line.getLiquidityPoolParameters()))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}
export class StellarMarketGateway implements MarketGateway {
  private readonly server: Pick<Horizon.Server, 'loadAccount'>;
  constructor(
    readonly network: NetworkContext,
    private readonly base: StellarGateway,
    private readonly read: (path: string) => Promise<unknown>,
    horizonUrl: string,
    server?: Pick<Horizon.Server, 'loadAccount'>,
  ) {
    this.server = server ?? new Horizon.Server(horizonUrl);
  }
  loadAccountState(address: string) {
    return this.base.loadAccountState(address);
  }
  loadLedgerParameters() {
    return this.base.loadLedgerParameters();
  }
  loadAccountAuthorization(address: string) {
    return this.base.loadAccountAuthorization(address);
  }
  transactionHash(value: string) {
    return this.base.transactionHash(value);
  }
  loadTransactionOutcome(value: string) {
    return this.base.loadTransactionOutcome(value);
  }
  async submitTransaction(value: string) {
    const result = await this.base.submitTransaction(value);
    if (result.status !== 'rejected') return result;
    const meanings: Record<string, string> = {
      op_malformed: 'invalid_request',
      op_no_trust: 'pool_share_trustline_missing',
      op_underfunded: 'insufficient_pool_shares',
      op_line_full: 'receiving_capacity_insufficient',
      op_under_minimum: 'under_minimum',
    };
    const first = new Transaction(value, this.network.networkPassphrase).operations[0];
    const code = result.operationResultCodes?.[0];
    return first?.type === 'liquidityPoolWithdraw' && code && meanings[code]
      ? { ...result, resultCode: meanings[code] }
      : result;
  }
  validAsset(asset: MarketAsset) {
    return (
      !!asset &&
      (asset.kind === 'native' ||
        (asset.kind === 'credit' &&
          /^[A-Za-z0-9]{1,12}$/.test(asset.code) &&
          StrKey.isValidEd25519PublicKey(asset.issuer)))
    );
  }
  async loadPool(id: string): Promise<Pool> {
    if (!/^[a-f0-9]{64}$/.test(id)) throw new Error('invalid_request');
    const result = await this.read(`/liquidity_pools/${id}`);
    if (!result) throw new Error('pool_not_found');
    const raw = object(result);
    if (raw.id !== id || raw.type !== 'constant_product' || !Array.isArray(raw.reserves) || raw.reserves.length !== 2)
      throw new Error('pool_state_unavailable');
    const a = object(raw.reserves[0]),
      b = object(raw.reserves[1]);
    const pool: Pool = {
      id,
      assetA: canonicalAsset(a.asset),
      assetB: canonicalAsset(b.asset),
      reserveA: numeric(a.amount),
      reserveB: numeric(b.amount),
      totalShares: numeric(raw.total_shares),
      protocolFee: raw.fee_bp as number,
      ...(Number.isSafeInteger(raw.last_modified_ledger) ? { ledger: raw.last_modified_ledger as number } : {}),
    };
    if (pool.protocolFee !== 30 || poolId(poolAsset(pool)) !== id) throw new Error('pool_identity_mismatch');
    return pool;
  }
  async listOffers(address: string) {
    if (!StrKey.isValidEd25519PublicKey(address)) throw new Error('invalid_request');
    const rows: Offer[] = [],
      seen = new Set<string>();
    let cursor = '';
    for (let page = 0; page < 20; page += 1) {
      const raw = object(
        await this.read(`/accounts/${address}/offers?limit=200&order=asc${cursor ? `&cursor=${cursor}` : ''}`),
      );
      const records = object(raw._embedded).records;
      if (!Array.isArray(records) || records.length > 200) throw new Error('market_invalid_response');
      for (const record of records) {
        const row = offer(record);
        if (row.seller !== address || seen.has(row.id)) throw new Error('market_invalid_response');
        seen.add(row.id);
        rows.push(row);
      }
      if (records.length < 200) return rows;
      const next = text(object(records[records.length - 1]).paging_token);
      if (!/^\d{1,40}$/.test(next) || next === cursor) throw new Error('market_invalid_response');
      cursor = next;
    }
    throw new Error('market_list_incomplete');
  }
  async loadOffer(id: string) {
    if (!/^[1-9]\d{0,18}$/.test(id)) throw new Error('invalid_request');
    const result = await this.read(`/offers/${id}`);
    if (!result) return undefined;
    const row = offer(result);
    if (row.id !== id) throw new Error('market_invalid_response');
    return row;
  }
  async build(source: string, operation: MarketOperation, baseFee: string, expires: number): Promise<string> {
    const account = await this.server.loadAccount(source);
    if (account.accountId() !== source) throw new Error('market_context_mismatch');
    let builder = new TransactionBuilder(account, { fee: baseFee, networkPassphrase: this.network.networkPassphrase });
    if (operation.type === 'exit') {
      if (poolId(poolAsset(operation.pool)) !== operation.pool.id) throw new Error('pool_identity_mismatch');
      builder = builder.addOperation(
        Operation.liquidityPoolWithdraw({
          liquidityPoolId: operation.pool.id,
          amount: operation.shares,
          minAmountA: operation.minA,
          minAmountB: operation.minB,
        }),
      );
      if (operation.close)
        builder = builder.addOperation(Operation.changeTrust({ asset: poolAsset(operation.pool), limit: '0' }));
    } else {
      const fields = {
        selling: toAsset(operation.selling),
        buying: toAsset(operation.buying),
        price: operation.price,
        offerId: operation.offerId,
      };
      builder = builder.addOperation(
        operation.type === 'buy'
          ? Operation.manageBuyOffer({ ...fields, buyAmount: operation.amount })
          : Operation.manageSellOffer({ ...fields, amount: operation.amount }),
      );
    }
    return builder.setTimebounds(0, expires).build().toXdr();
  }
  inspect(value: string) {
    const transaction = new Transaction(value, this.network.networkPassphrase);
    if (
      transaction.signatures.length ||
      transaction.memo.type !== 'none' ||
      !transaction.timeBounds ||
      transaction.timeBounds.minTime !== '0' ||
      transaction.ledgerBounds !== undefined ||
      transaction.minAccountSequence !== undefined ||
      transaction.minAccountSequenceAge !== undefined ||
      transaction.minAccountSequenceLedgerGap !== undefined ||
      transaction.extraSigners !== undefined ||
      transaction.operations.some(op => op.source)
    )
      throw new Error('market_review_mismatch');
    const expiresAtUnixSeconds = Number(transaction.timeBounds.maxTime);
    if (!Number.isSafeInteger(expiresAtUnixSeconds) || expiresAtUnixSeconds <= 0)
      throw new Error('market_review_mismatch');
    const op = transaction.operations[0];
    let operation: EncodedMarketOperation;
    if (op?.type === 'liquidityPoolWithdraw') {
      const close = transaction.operations.length === 2;
      if (transaction.operations.length !== 1 && !close) throw new Error('market_review_mismatch');
      const last = transaction.operations[1];
      let cleanup: Extract<EncodedMarketOperation, { type: 'exit' }>['cleanup'];
      if (close) {
        if (
          last.type !== 'changeTrust' ||
          !(last.line instanceof LiquidityPoolAsset) ||
          stroops(last.limit) !== 0n ||
          poolId(last.line) !== op.liquidityPoolId
        )
          throw new Error('market_review_mismatch');
        cleanup = {
          assetA: fromAsset(last.line.assetA),
          assetB: fromAsset(last.line.assetB),
          protocolFee: last.line.fee,
        };
      }
      operation = {
        type: 'exit',
        poolId: op.liquidityPoolId,
        shares: op.amount,
        minA: op.minAmountA,
        minB: op.minAmountB,
        close,
        ...(cleanup ? { cleanup } : {}),
      };
    } else if (
      (op?.type === 'manageBuyOffer' || op?.type === 'manageSellOffer') &&
      transaction.operations.length === 1
    ) {
      const envelope = xdr.TransactionEnvelope.fromXdr(value, 'base64');
      if (envelope.type !== 'envelopeTypeTx') throw new Error('market_review_mismatch');
      const body = envelope.v1.tx.operations[0].body;
      if (body.type !== 'manageBuyOffer' && body.type !== 'manageSellOffer') throw new Error('market_review_mismatch');
      const price = body.type === 'manageBuyOffer' ? body.manageBuyOfferOp.price : body.manageSellOfferOp.price;
      operation = {
        type: op.type === 'manageBuyOffer' ? 'buy' : 'sell',
        selling: fromAsset(op.selling),
        buying: fromAsset(op.buying),
        amount: op.type === 'manageBuyOffer' ? op.buyAmount : op.amount,
        price: { n: price.n, d: price.d },
        offerId: op.offerId,
      };
    } else throw new Error('market_review_mismatch');
    return { source: transaction.source, fee: transaction.fee, expiresAtUnixSeconds, operation };
  }
}
