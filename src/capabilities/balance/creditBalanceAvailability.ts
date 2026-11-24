import { amount, stroops } from '../stellar/classicAmounts';
import type { BalanceLine } from './types';

export type CreditAuthorization = 'authorized' | 'maintain-liabilities' | 'unauthorized' | 'unknown';
export type CreditSendBlockedReason = 'unknown' | 'maintain-liabilities' | 'unauthorized' | 'no-available-balance';
export type CreditRemoveBlockedReason = 'unknown' | 'balance-not-zero' | 'liabilities';
export type CreditBalanceAvailability = Readonly<{
  balance?: string;
  available?: string;
  receivingCapacity?: string;
  buyingLiabilities?: string;
  sellingLiabilities?: string;
  authorization: CreditAuthorization;
  clawbackEnabled?: boolean;
  canSend: boolean;
  sendBlockedReason?: CreditSendBlockedReason;
  canRemove: boolean;
  removeBlockedReason?: CreditRemoveBlockedReason;
}>;

// Public display facts only. A cached projection never authorizes a payment,
// swap or trustline mutation; the live preparation capabilities remain final.
export function projectCreditBalanceAvailability(line: BalanceLine): CreditBalanceAvailability {
  const balance = readAmount(line.balance);
  const limit = readAmount(line.limit);
  const buying = readAmount(line.buyingLiabilities);
  const selling = readAmount(line.sellingLiabilities);
  const available = balance === undefined || selling === undefined ? undefined : nonnegative(balance - selling);
  const receivingCapacity =
    balance === undefined || limit === undefined || buying === undefined
      ? undefined
      : nonnegative(limit - balance - buying);
  const authorization: CreditAuthorization =
    line.isAuthorized === true
      ? 'authorized'
      : line.isAuthorized === false
        ? line.isAuthorizedToMaintainLiabilities === true
          ? 'maintain-liabilities'
          : 'unauthorized'
        : 'unknown';
  const sendBlockedReason: CreditSendBlockedReason | undefined =
    authorization !== 'authorized'
      ? authorization
      : available === undefined
        ? 'unknown'
        : available === 0n
          ? 'no-available-balance'
          : undefined;
  const removeBlockedReason: CreditRemoveBlockedReason | undefined =
    balance === undefined
      ? 'unknown'
      : balance !== 0n
        ? 'balance-not-zero'
        : buying === undefined || selling === undefined
          ? 'unknown'
          : buying !== 0n || selling !== 0n
            ? 'liabilities'
            : undefined;

  return {
    ...(balance === undefined ? {} : { balance: amount(balance) }),
    ...(available === undefined ? {} : { available: amount(available) }),
    ...(receivingCapacity === undefined ? {} : { receivingCapacity: amount(receivingCapacity) }),
    ...(buying === undefined ? {} : { buyingLiabilities: amount(buying) }),
    ...(selling === undefined ? {} : { sellingLiabilities: amount(selling) }),
    authorization,
    ...(typeof line.isClawbackEnabled !== 'boolean' ? {} : { clawbackEnabled: line.isClawbackEnabled }),
    canSend: sendBlockedReason === undefined,
    ...(sendBlockedReason === undefined ? {} : { sendBlockedReason }),
    canRemove: removeBlockedReason === undefined,
    ...(removeBlockedReason === undefined ? {} : { removeBlockedReason }),
  };
}

function readAmount(value: string | undefined): bigint | undefined {
  if (value === undefined) return undefined;
  try {
    return stroops(value);
  } catch {
    return undefined;
  }
}
function nonnegative(value: bigint): bigint {
  return value > 0n ? value : 0n;
}
