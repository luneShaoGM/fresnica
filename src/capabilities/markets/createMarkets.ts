import type { BalanceLine } from '../balance/types';
import type { AccountRecord } from '../account/types';
import type { StellarAccountState } from '../stellar/types';
import { amount, assetKey, stroops } from '../stellar/classicAmounts';
import { preflightExit } from '../liquidity-pool/exitPolicy';
import { offerLiabilities, offerOperation, preflightOffer } from '../sdex/offerPolicy';
import { createTransactionIntentIdentity } from '../transaction/pendingSubmission';
import { submitReviewedTransaction } from '../transaction/submitReviewedTransaction';
import type {
  EncodedMarketOperation,
  MarketDependencies,
  MarketOperation,
  MarketRequest,
  MarketReview,
  Offer,
} from './types';

export function operationIdentity(op: EncodedMarketOperation): string {
  return op.type === 'exit'
    ? JSON.stringify([
        'exit',
        op.poolId,
        amount(stroops(op.shares)),
        amount(stroops(op.minA)),
        amount(stroops(op.minB)),
        op.close,
        op.cleanup ? [assetKey(op.cleanup.assetA), assetKey(op.cleanup.assetB), op.cleanup.protocolFee] : null,
      ])
    : JSON.stringify([
        op.type,
        assetKey(op.selling),
        assetKey(op.buying),
        amount(stroops(op.amount)),
        op.price.n,
        op.price.d,
        op.offerId,
      ]);
}
function encoded(op: MarketOperation): EncodedMarketOperation {
  return op.type === 'exit'
    ? {
        type: 'exit',
        poolId: op.pool.id,
        shares: op.shares,
        minA: op.minA,
        minB: op.minB,
        close: op.close,
        ...(op.close
          ? { cleanup: { assetA: op.pool.assetA, assetB: op.pool.assetB, protocolFee: op.pool.protocolFee } }
          : {}),
      }
    : op;
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(child => freeze(child));
    Object.freeze(value);
  }
  return value;
}
export type Markets = ReturnType<typeof createMarkets>;
export function createMarkets(dependencies: MarketDependencies) {
  const { gateway, network } = dependencies;
  const issued = new WeakMap<MarketReview, { request: MarketRequest; offer?: Offer }>();
  function account(id: string): AccountRecord {
    const value = dependencies.repository.getAccount(id);
    if (
      !value ||
      value.hidden ||
      value.identityKind !== 'classic' ||
      value.networkId !== network.id ||
      gateway.network.id !== network.id ||
      gateway.network.networkPassphrase !== network.networkPassphrase
    )
      throw new Error('market_context_mismatch');
    return value;
  }
  async function state(id: string): Promise<StellarAccountState> {
    const source = account(id);
    const result = await gateway.loadAccountState(source.address);
    if (result.status !== 'active' || result.account.address !== source.address) throw new Error('account_inactive');
    account(id);
    return result.account;
  }
  async function ownedOffer(source: AccountRecord, id?: string) {
    if (!id || !/^[1-9]\d{0,18}$/.test(id)) throw new Error('invalid_request');
    const offer = await gateway.loadOffer(id);
    if (!offer || offer.id !== id) throw new Error('offer_not_found');
    if (offer.seller !== source.address) throw new Error('offer_owner_mismatch');
    return offer;
  }
  async function prepare(id: string, input: MarketRequest, isCurrent: () => boolean): Promise<MarketReview> {
    const source = account(id);
    const current = () => {
      if (!isCurrent() || account(id).address !== source.address) throw new Error('market_session_retired');
    };
    current();
    const started = dependencies.monotonic();
    const snapshotAt = dependencies.now();
    const request = freeze(JSON.parse(JSON.stringify(input)) as MarketRequest);
    const ledger = await gateway.loadLedgerParameters();
    const sourceState = await state(id);
    current();
    let operation: MarketOperation;
    let old: Offer | undefined;
    let fee = String(ledger.baseFeeStroops);
    const facts: { key: string; value: string }[] = [];
    const fact = (key: string, value: string) => facts.push({ key, value });
    if (request.kind === 'exit') {
      if (
        !/^[a-f0-9]{64}$/.test(request.poolId) ||
        !['all', 'exact_shares'].includes(request.mode) ||
        typeof request.close !== 'boolean'
      )
        throw new Error('invalid_request');
      let pool;
      try {
        pool = await gateway.loadPool(request.poolId);
      } catch (failure) {
        if (
          failure instanceof Error &&
          ['pool_identity_mismatch', 'pool_not_found', 'pool_state_unavailable'].includes(failure.message)
        )
          throw failure;
        throw new Error('pool_state_unavailable');
      }
      current();
      if (pool.id !== request.poolId) throw new Error('pool_identity_mismatch');
      const result = preflightExit(sourceState, pool, request, ledger);
      fee = result.fee;
      operation = {
        type: 'exit',
        pool,
        shares: result.shares,
        minA: result.minA,
        minB: result.minB,
        close: request.close,
      };
      fact('poolId', pool.id);
      fact('assetA', assetKey(pool.assetA));
      fact('assetB', assetKey(pool.assetB));
      fact('mode', request.mode);
      fact('shares', result.shares);
      fact('expectedA', result.expectedA);
      fact('expectedB', result.expectedB);
      fact('slippage', String(request.slippageBps));
      fact('minimumA', result.minA);
      fact('minimumB', result.minB);
      fact('snapshot', new Date(snapshotAt).toISOString());
      fact('ledger', pool.ledger === undefined ? '—' : String(pool.ledger));
      fact('cleanup', request.close ? 'close' : 'keep');
      fact('reserveReleased', result.reserveReleased);
      fact(
        'sponsorReserveReleased',
        request.close && result.sponsor ? amount(2n * BigInt(ledger.baseReserveStroops)) : amount(0n),
      );
      fact('subentriesReleased', request.close ? '2' : '0');
      fact('sponsor', result.sponsor ?? '—');
      fact('operations', request.close ? 'withdraw_close' : 'withdraw');
    } else {
      if (
        !['create', 'update', 'cancel'].includes(request.action) ||
        !['buy', 'sell'].includes(request.side) ||
        !gateway.validAsset(request.base) ||
        !gateway.validAsset(request.counter)
      )
        throw new Error('invalid_request');
      if (request.action !== 'create') old = await ownedOffer(source, request.offerId);
      else if (request.offerId !== undefined) throw new Error('invalid_request');
      operation = offerOperation(request, old);
      preflightOffer(sourceState, operation, ledger, old);
      fact('action', request.action);
      fact('side', operation.type);
      fact('base', assetKey(request.base));
      fact('counter', assetKey(request.counter));
      fact('selling', assetKey(operation.selling));
      fact('buying', assetKey(operation.buying));
      fact('amount', operation.amount);
      fact('requestedPrice', request.action === 'cancel' ? '—' : request.price);
      fact('effectivePrice', `${operation.price.n}/${operation.price.d}`);
      fact('offerId', operation.offerId);
      const liability = offerLiabilities(operation.type, operation.amount, operation.price);
      fact('requiredSelling', amount(liability.selling));
      fact('requiredBuying', amount(liability.buying));
      fact('counterTotal', `${operation.amount} × ${operation.price.n}/${operation.price.d}`);
      fact('operations', operation.type === 'buy' ? 'buy_offer' : 'sell_offer');
    }
    current();
    const expires = Math.floor(dependencies.now() / 1000) + 180;
    const xdr = await gateway.build(source.address, operation, String(ledger.baseFeeStroops), expires);
    current();
    if (request.kind === 'exit') {
      if (request.mode === 'all' && operation.type === 'exit') {
        const latest = await state(id);
        current();
        const line = latest.balances.find(
          balance => balance.kind === 'liquidity-pool-share' && balance.liquidityPoolId === request.poolId,
        );
        if (!line) throw new Error('pool_share_trustline_missing');
        if (stroops(line.balance) !== stroops(operation.shares)) throw new Error('pool_state_stale');
      }
      const age = dependencies.monotonic() - started;
      if (
        !Number.isFinite(started) ||
        !Number.isFinite(age) ||
        age < 0 ||
        age >= 30000 ||
        dependencies.now() < snapshotAt ||
        dependencies.now() - snapshotAt >= 30000
      )
        throw new Error('pool_state_stale');
    }
    const exact = gateway.inspect(xdr);
    if (
      exact.source !== source.address ||
      exact.fee !== fee ||
      exact.expiresAtUnixSeconds !== expires ||
      operationIdentity(exact.operation) !== operationIdentity(encoded(operation))
    )
      throw new Error('market_review_mismatch');
    fact('fee', amount(BigInt(fee)));
    fact('expires', new Date(expires * 1000).toISOString());
    const review = freeze({
      transactionXdrBase64: xdr,
      networkId: network.id,
      source: source.address,
      fee,
      expiresAtUnixSeconds: expires,
      accountId: id,
      kind: request.kind,
      operation,
      facts,
    } as MarketReview);
    issued.set(review, { request, ...(old ? { offer: freeze(old) } : {}) });
    return review;
  }
  return Object.freeze({
    networkId: network.id,
    async list(id: string, kind: 'orders' | 'pools') {
      const source = account(id);
      const loaded = await state(id);
      const offers = kind === 'orders' ? await gateway.listOffers(source.address) : [];
      if (offers.some(offer => offer.seller !== source.address)) throw new Error('offer_owner_mismatch');
      const positions = await Promise.all(
        loaded.balances
          .filter(line => kind === 'pools' && line.kind === 'liquidity-pool-share' && stroops(line.balance) > 0n)
          .map(async line => {
            if (line.kind !== 'liquidity-pool-share') throw new Error('invalid_request');
            try {
              const pool = await gateway.loadPool(line.liquidityPoolId);
              const total = stroops(pool.totalShares),
                shares = stroops(line.balance);
              if (total === 0n || shares > total) throw new Error('pool_state_unavailable');
              return {
                id: line.liquidityPoolId,
                shares: line.balance,
                pool,
                underlyingA: amount((shares * stroops(pool.reserveA)) / total),
                underlyingB: amount((shares * stroops(pool.reserveB)) / total),
              };
            } catch {
              return { id: line.liquidityPoolId, shares: line.balance };
            }
          }),
      );
      account(id);
      return {
        offers,
        positions,
        balances: loaded.balances.flatMap<BalanceLine>(line =>
          line.kind === 'native'
            ? [{ asset: { kind: 'native', code: 'XLM' }, balance: line.balance }]
            : line.kind === 'credit'
              ? [{ asset: { kind: 'credit', code: line.code, issuer: line.issuer }, balance: line.balance }]
              : [],
        ),
      };
    },
    prepare,
    outcome: (hash: string) => dependencies.recovery.repository.get(network.id, hash)?.state,
    async submit(review: MarketReview, passphrase: string | undefined, isCurrent: () => boolean) {
      if (!isCurrent()) throw new Error('market_session_retired');
      const proof = issued.get(review);
      if (!proof) throw new Error('market_review_mismatch');
      const source = account(review.accountId);
      if (review.source !== source.address || review.networkId !== network.id)
        throw new Error('market_context_mismatch');
      if (proof.request.kind === 'offer') {
        const old = proof.offer ? await ownedOffer(source, proof.offer.id) : undefined;
        if (old && JSON.stringify(old) !== JSON.stringify(proof.offer)) throw new Error('offer_state_changed');
        const sourceState = await state(source.id);
        const ledger = await gateway.loadLedgerParameters();
        if (review.operation.type === 'exit' || review.fee !== String(ledger.baseFeeStroops))
          throw new Error('market_review_mismatch');
        preflightOffer(sourceState, review.operation, ledger, old);
      }
      if (!isCurrent()) throw new Error('market_session_retired');
      const signers = dependencies.repository.listSignersForAccount(source.id);
      if (signers.length !== 1) throw new Error(signers.length === 0 ? 'watch_only' : 'unsupported_signer');
      const identity =
        review.operation.type === 'exit'
          ? ['pool', review.operation.pool.id]
          : review.operation.offerId !== '0'
            ? ['offer', review.operation.offerId]
            : ['new', assetKey(review.operation.selling), assetKey(review.operation.buying)];
      return submitReviewedTransaction({
        gateway,
        sdk: dependencies.sdk,
        review,
        accountId: source.id,
        signer: signers[0],
        intent: createTransactionIntentIdentity('market', identity),
        recovery: dependencies.recovery,
        thresholdLevel: 'medium',
        appPassphrase: passphrase,
        networkPassphrase: network.networkPassphrase,
        isCurrent,
      });
    },
  });
}
