import type { Asset, Offer, OfferOperation, OfferRequest, Price } from '../markets/types';
import type { StellarAccountState, StellarLedgerParameters } from '../stellar/types';
import {
  amount,
  assetKey,
  lineFor,
  MAX_STROOPS,
  nativeAvailable,
  receivingCapacity,
  stroops,
} from '../stellar/classicAmounts';

// Bounded continued fractions, including the last admissible semi-convergent.
export function rationalPrice(decimal: string): Price {
  const numerator = stroops(decimal);
  if (numerator <= 0n) throw new Error('invalid_request');
  const denominator = 10_000_000n,
    bound = 2_147_483_647n;
  let n = numerator,
    d = denominator,
    p0 = 0n,
    q0 = 1n,
    p1 = 1n,
    q1 = 0n;
  while (d !== 0n) {
    const a = n / d;
    const p = p0 + a * p1,
      q = q0 + a * q1;
    if (p > bound || q > bound) {
      const kp = p1 === 0n ? bound : (bound - p0) / p1;
      const kq = q1 === 0n ? bound : (bound - q0) / q1;
      const k = kp < kq ? kp : kq;
      const sp = p0 + k * p1,
        sq = q0 + k * q1;
      const abs = (value: bigint) => (value < 0n ? -value : value);
      if (
        sp > 0n &&
        sq > 0n &&
        (p1 === 0n ||
          q1 === 0n ||
          abs(sp * denominator - numerator * sq) * q1 < abs(p1 * denominator - numerator * q1) * sq)
      ) {
        p1 = sp;
        q1 = sq;
      }
      break;
    }
    p0 = p1;
    q0 = q1;
    p1 = p;
    q1 = q;
    const rest = n % d;
    n = d;
    d = rest;
  }
  if (p1 <= 0n || q1 <= 0n) throw new Error('invalid_request');
  return Object.freeze({ n: Number(p1), d: Number(q1) });
}

// Stellar exchange-v10 liability arithmetic, as specified by Fresnica SDEX.
export function offerLiabilities(side: 'buy' | 'sell', value: string, price: Price) {
  const a = stroops(value);
  const n = BigInt(side === 'sell' ? price.n : price.d),
    d = BigInt(side === 'sell' ? price.d : price.n);
  if (n <= 0n || d <= 0n || n > 2147483647n || d > 2147483647n) throw new Error('invalid_request');
  const min = (x: bigint, y: bigint) => (x < y ? x : y);
  const valueLimit = min((side === 'sell' ? a : MAX_STROOPS) * n, (side === 'buy' ? a : MAX_STROOPS) * d);
  const otherLimit = MAX_STROOPS * min(n, d);
  const stays = valueLimit > otherLimit;
  const limit = stays ? otherLimit : valueLimit;
  let selling: bigint, buying: bigint;
  if (n > d) {
    selling = limit / n;
    buying = (selling * n + (stays ? d - 1n : 0n)) / d;
  } else {
    buying = limit / d;
    selling = (buying * d + (stays ? 0n : n - 1n)) / n;
  }
  return { selling, buying };
}
export function offerOperation(request: OfferRequest, old?: Offer): OfferOperation {
  if (assetKey(request.base) === assetKey(request.counter)) throw new Error('invalid_request');
  if (request.action === 'cancel') {
    if (!old) throw new Error('offer_not_found');
    if (assetKey(request.base) !== assetKey(old.selling) || assetKey(request.counter) !== assetKey(old.buying))
      throw new Error('offer_pair_mismatch');
    return {
      type: 'sell',
      selling: old.selling,
      buying: old.buying,
      amount: amount(0n),
      price: old.price,
      offerId: old.id,
    };
  }
  const price = rationalPrice(request.price);
  if (stroops(request.amount) <= 0n) throw new Error('invalid_request');
  const selling = request.side === 'sell' ? request.base : request.counter;
  const buying = request.side === 'sell' ? request.counter : request.base;
  if (
    request.action === 'update' &&
    (!old || assetKey(selling) !== assetKey(old.selling) || assetKey(buying) !== assetKey(old.buying))
  )
    throw new Error('offer_pair_mismatch');
  return Object.freeze({
    type: request.side,
    selling,
    buying,
    amount: amount(stroops(request.amount)),
    price,
    offerId: old?.id ?? '0',
  });
}
export function preflightOffer(
  account: StellarAccountState,
  operation: OfferOperation,
  ledger: StellarLedgerParameters,
  old?: Offer,
) {
  if (old) {
    const released = offerLiabilities('sell', old.amount, old.price);
    account = {
      ...account,
      balances: account.balances.map(line => {
        if (line.kind === 'liquidity-pool-share') return line;
        const key = line.kind === 'native' ? 'XLM' : `${line.code}:${line.issuer}`;
        return {
          ...line,
          sellingLiabilities: amount(
            stroops(line.sellingLiabilities) - (key === assetKey(old.selling) ? released.selling : 0n),
          ),
          buyingLiabilities: amount(
            stroops(line.buyingLiabilities ?? '0') - (key === assetKey(old.buying) ? released.buying : 0n),
          ),
        };
      }),
    };
  }
  const freeNative = nativeAvailable(account, ledger, BigInt(ledger.baseFeeStroops));
  if (stroops(operation.amount) === 0n) return;
  const liabilities = offerLiabilities(operation.type, operation.amount, operation.price);
  function fullAuthorization(asset: Asset) {
    if (asset.kind === 'native' || asset.issuer === account.address) return;
    const line = lineFor(account, asset);
    if (!line || line.kind !== 'credit') throw new Error('receiving_trustline_missing');
    if (!line.isAuthorized) throw new Error('not_authorized');
  }
  fullAuthorization(operation.selling);
  fullAuthorization(operation.buying);
  const reserve = old ? 0n : BigInt(ledger.baseReserveStroops);
  let available = MAX_STROOPS;
  if (operation.selling.kind === 'native') available = freeNative;
  else if (operation.selling.issuer !== account.address) {
    const line = lineFor(account, operation.selling);
    if (!line || line.kind !== 'credit') throw new Error('insufficient_source');
    available = stroops(line.balance) - stroops(line.sellingLiabilities);
  }
  if (freeNative < reserve) throw new Error('insufficient_fee');
  if (liabilities.selling > available - (operation.selling.kind === 'native' ? reserve : 0n))
    throw new Error('insufficient_source');
  if (liabilities.buying > receivingCapacity(account, operation.buying))
    throw new Error('receiving_capacity_insufficient');
}
