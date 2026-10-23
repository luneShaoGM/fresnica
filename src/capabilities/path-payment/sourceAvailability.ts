import type {
  StellarAccountState,
  StellarLedgerParameters,
  StellarPaymentAsset,
  StellarTrustlineBalance,
} from '../stellar/types';

const STROOPS_PER_UNIT = 10_000_000n;
const AMOUNT_PATTERN = /^(0|[1-9]\d*)(?:\.(\d{1,7}))?$/;

export type PathPaymentSourceAvailability = Readonly<{
  asset: StellarPaymentAsset;
  balance: string;
  spendable: string;
}>;

export function projectPathPaymentSourceAvailability(
  account: StellarAccountState,
  ledger: StellarLedgerParameters,
): readonly PathPaymentSourceAvailability[] {
  const ledgerValues = [ledger.baseFeeStroops, ledger.baseReserveStroops];
  const accountCounts = [account.subentryCount, account.numSponsoring, account.numSponsored];
  if (
    ledgerValues.some(value => !Number.isSafeInteger(value) || value < 0) ||
    accountCounts.some(value => !Number.isSafeInteger(value) || value < 0)
  ) {
    throw new Error('quote_unavailable');
  }
  const reserveUnits = Math.max(0, 2 + account.subentryCount + account.numSponsoring - account.numSponsored);
  if (!Number.isSafeInteger(reserveUnits)) throw new Error('quote_unavailable');

  const options = account.balances.flatMap<PathPaymentSourceAvailability>(balance => {
    if (balance.kind === 'liquidity-pool-share') return [];
    if (balance.kind === 'native') {
      const reserved = BigInt(reserveUnits) * BigInt(ledger.baseReserveStroops) + BigInt(ledger.baseFeeStroops);
      const spendable = clampToZero(
        parseStroops(balance.balance) - parseStroops(balance.sellingLiabilities) - reserved,
      );
      return [
        Object.freeze({
          asset: Object.freeze({kind: 'native'} as const),
          balance: balance.balance,
          spendable: formatStroops(spendable),
        }),
      ];
    }
    if (!balance.isAuthorized) return [];
    const spendable = clampToZero(
      parseStroops(balance.balance) - parseStroops((balance as StellarTrustlineBalance).sellingLiabilities),
    );
    return [
      Object.freeze({
        asset: Object.freeze({kind: 'credit', code: balance.code, issuer: balance.issuer} as const),
        balance: balance.balance,
        spendable: formatStroops(spendable),
      }),
    ];
  });
  return Object.freeze([
    ...options.filter(option => option.asset.kind === 'native'),
    ...options.filter(option => option.asset.kind === 'credit'),
  ]);
}

function parseStroops(value: string): bigint {
  const match = AMOUNT_PATTERN.exec(value);
  if (!match) throw new Error('quote_unavailable');
  return BigInt(match[1]) * STROOPS_PER_UNIT + BigInt((match[2] ?? '').padEnd(7, '0') || '0');
}

function formatStroops(value: bigint): string {
  const whole = value / STROOPS_PER_UNIT;
  const fraction = String(value % STROOPS_PER_UNIT).padStart(7, '0');
  return `${whole}.${fraction}`;
}

function clampToZero(value: bigint): bigint {
  return value < 0n ? 0n : value;
}
