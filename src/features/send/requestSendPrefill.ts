import type { AccountRecord } from '../../capabilities/account/types';
import type { BalanceAsset, BalanceLine } from '../../capabilities/balance/types';
import type { NetworkContext } from '../../capabilities/network/types';
import type { RequestPaymentIntent } from '../../capabilities/request/requestUri';
import type { StellarPaymentMemo } from '../../capabilities/stellar/types';

export type RequestSendPrefill =
  | Readonly<{
      kind: 'ready';
      destination: string;
      amount: string;
      asset: BalanceAsset;
      memoType: 'none' | StellarPaymentMemo['type'];
      memoValue: string;
    }>
  | Readonly<{ kind: 'blocked'; reason: 'account-ineligible' | 'asset-unavailable' }>;

export function resolveRequestSendPrefill(
  intent: RequestPaymentIntent,
  account: AccountRecord,
  network: NetworkContext,
  balances: readonly BalanceLine[],
  isWatchOnly: boolean,
): RequestSendPrefill {
  if (
    account.hidden ||
    account.identityKind !== 'classic' ||
    account.networkId !== network.id ||
    intent.networkId !== network.id ||
    intent.networkPassphrase !== network.networkPassphrase ||
    isWatchOnly
  ) {
    return { kind: 'blocked', reason: 'account-ineligible' };
  }

  const selected = balances.find(line =>
    intent.asset.kind === 'native'
      ? line.asset.kind === 'native'
      : line.asset.kind === 'credit' &&
        line.asset.code === intent.asset.code &&
        line.asset.issuer === intent.asset.issuer,
  );
  if (selected === undefined) {
    return { kind: 'blocked', reason: 'asset-unavailable' };
  }

  return {
    kind: 'ready',
    destination: intent.destination,
    amount: intent.amount ?? '',
    asset: selected.asset,
    memoType: intent.memo?.type ?? 'none',
    memoValue: intent.memo?.value ?? '',
  };
}
