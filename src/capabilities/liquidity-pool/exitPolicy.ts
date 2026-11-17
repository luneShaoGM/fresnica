import type { ExitRequest, Pool } from '../markets/types';
import type { StellarAccountState, StellarLedgerParameters } from '../stellar/types';
import { amount, nativeAvailable, receivingCapacity, stroops } from '../stellar/classicAmounts';

export function exitAmounts(pool: Pool, owned: string, request: ExitRequest) {
  if (!Number.isInteger(request.slippageBps) || request.slippageBps < 0 || request.slippageBps > 1000)
    throw new Error('slippage_out_of_range');
  if (request.close && request.mode !== 'all') throw new Error('close_requires_full_exit');
  const total = stroops(pool.totalShares);
  const shares = request.mode === 'all' ? stroops(owned) : stroops(request.shares ?? '');
  if (total === 0n) throw new Error('pool_state_unavailable');
  if (shares <= 0n || shares > stroops(owned) || shares > total) throw new Error('insufficient_pool_shares');
  const expectedA = (shares * stroops(pool.reserveA)) / total;
  const expectedB = (shares * stroops(pool.reserveB)) / total;
  if (expectedA === 0n && expectedB === 0n) throw new Error('withdrawal_too_small');
  const minimum = (value: bigint) => (value === 0n ? 0n : (value * BigInt(10000 - request.slippageBps)) / 10000n || 1n);
  return Object.freeze({
    shares: amount(shares),
    expectedA: amount(expectedA),
    expectedB: amount(expectedB),
    minA: amount(minimum(expectedA)),
    minB: amount(minimum(expectedB)),
  });
}
export function preflightExit(
  account: StellarAccountState,
  pool: Pool,
  request: ExitRequest,
  ledger: StellarLedgerParameters,
) {
  const line = account.balances.find(
    balance => balance.kind === 'liquidity-pool-share' && balance.liquidityPoolId === pool.id,
  );
  if (!line || line.kind !== 'liquidity-pool-share') throw new Error('pool_share_trustline_missing');
  const result = exitAmounts(pool, line.balance, request);
  const fee = BigInt(ledger.baseFeeStroops) * (request.close ? 2n : 1n);
  nativeAvailable(account, ledger, fee);
  // Exits unwind a position; ordinary receipt's full-authorization rule does not apply.
  if (
    receivingCapacity(account, pool.assetA) < stroops(result.expectedA) ||
    receivingCapacity(account, pool.assetB) < stroops(result.expectedB)
  )
    throw new Error('receiving_capacity_insufficient');
  return {
    ...result,
    fee: String(fee),
    sponsor: line.sponsor,
    reserveReleased: request.close && !line.sponsor ? amount(2n * BigInt(ledger.baseReserveStroops)) : amount(0n),
  };
}
