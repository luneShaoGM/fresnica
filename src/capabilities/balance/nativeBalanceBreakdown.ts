import type { AccountRecord } from '../account/types';
import type { StellarAccountState, StellarAccountStateResult, StellarLedgerParameters } from '../stellar/types';

const STROOPS = 10_000_000n;

export type NativeBalanceReader = Readonly<{
  networkId: string;
  loadAccountState: (address: string) => Promise<StellarAccountStateResult>;
  loadLedgerParameters: () => Promise<StellarLedgerParameters>;
}>;

export type NativeBalanceBreakdown = Readonly<{
  total: string;
  available: string;
  reserved: string;
  accountMinimum: string;
  grossEntryReserve: string;
  sponsorshipOffset: string;
  sellingLiabilities: string;
  subentryCount: number;
  numSponsoring: number;
  numSponsored: number;
  trustlines: readonly Readonly<{ code: string; issuer: string; limit?: string; authorized: boolean }>[];
}>;

function parseStroops(value: string): bigint {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,7})?$/.test(value)) throw new Error('invalid-native-balance');
  const [integer, fraction = ''] = value.split('.');
  return BigInt(integer) * STROOPS + BigInt(fraction.padEnd(7, '0'));
}

function toXlm(value: bigint): string {
  const whole = value / STROOPS;
  return whole.toString() + '.' + (value % STROOPS).toString().padStart(7, '0');
}

export function projectNativeBalanceBreakdown(
  account: StellarAccountState,
  ledger: StellarLedgerParameters,
): NativeBalanceBreakdown {
  const { subentryCount, numSponsored, numSponsoring } = account;
  if (
    ![subentryCount, numSponsored, numSponsoring].every(count => Number.isSafeInteger(count) && count >= 0) ||
    !Number.isSafeInteger(ledger.baseReserveStroops) ||
    ledger.baseReserveStroops <= 0
  )
    throw new Error('invalid-native-reserve');
  const native = account.balances.find(line => line.kind === 'native');
  if (!native || native.kind !== 'native') throw new Error('missing-native-balance');
  const total = parseStroops(native.balance);
  const selling = parseStroops(native.sellingLiabilities);
  const units = 2 + subentryCount + numSponsoring - numSponsored;
  if (!Number.isSafeInteger(units)) throw new Error('invalid-native-reserve');
  const reserve = BigInt(Math.max(0, units)) * BigInt(ledger.baseReserveStroops);
  const base = 2n * BigInt(ledger.baseReserveStroops);
  const remaining = total - reserve - selling;
  return {
    total: toXlm(total),
    available: toXlm(remaining > 0n ? remaining : 0n),
    reserved: toXlm(reserve),
    accountMinimum: toXlm(base),
    grossEntryReserve: toXlm(BigInt(subentryCount + numSponsoring) * BigInt(ledger.baseReserveStroops)),
    sponsorshipOffset: toXlm(BigInt(numSponsored) * BigInt(ledger.baseReserveStroops)),
    sellingLiabilities: toXlm(selling),
    subentryCount,
    numSponsoring,
    numSponsored,
    trustlines: account.balances.flatMap(line =>
      line.kind === 'credit'
        ? [
            {
              code: line.code,
              issuer: line.issuer,
              ...(line.limit === undefined ? {} : { limit: line.limit }),
              authorized: line.isAuthorized,
            },
          ]
        : [],
    ),
  };
}

export async function loadNativeBalanceBreakdown(
  reader: NativeBalanceReader | undefined,
  account: Pick<AccountRecord, 'address' | 'networkId' | 'identityKind'>,
): Promise<NativeBalanceBreakdown> {
  if (!reader || reader.networkId !== account.networkId || account.identityKind !== 'classic')
    throw new Error('native-breakdown-network-mismatch');
  const [response, ledger] = await Promise.all([
    reader.loadAccountState(account.address),
    reader.loadLedgerParameters(),
  ]);
  if (
    reader.networkId !== account.networkId ||
    response.status !== 'active' ||
    response.account.address !== account.address
  )
    throw new Error('native-breakdown-account-mismatch');
  return projectNativeBalanceBreakdown(response.account, ledger);
}
