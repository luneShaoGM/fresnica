import { formatPublicAddress } from '@ui/formatPublicAddress';

import type { AccountRecord } from '../../capabilities/account/types';
import type { BalanceSnapshot } from '../../capabilities/balance/types';

export type HomeBalanceState =
  | Readonly<{ kind: 'loading' }>
  | Readonly<{ kind: 'error'; message: string }>
  | Readonly<{
      kind: 'ready';
      snapshot: BalanceSnapshot;
      stale?: boolean;
      revalidating?: boolean;
    }>;

export type HomeViewModel = Readonly<{
  accountLabel: string;
  accountAddress: string;
  maskedAddress: string;
  accountKindLabel: string;
  networkLabel: string;
  isReadOnly: boolean;
  canSend: boolean;
  canSwap: boolean;
  canRequest: boolean;
  canManageAssets: boolean;
  canFundWithFriendbot: boolean;
}>;

type HomeAvailability = Readonly<{
  swap: boolean;
  request: boolean;
  friendbot?: boolean;
}>;

export function createHomeViewModel(
  account: AccountRecord,
  canSign: boolean,
  balanceState: HomeBalanceState,
  availability: HomeAvailability,
): HomeViewModel {
  const isClassic = account.identityKind === 'classic';
  const isReadOnly = !canSign || !isClassic;
  const isActive = balanceState.kind === 'ready' && balanceState.snapshot.status === 'active';
  const isInactive = balanceState.kind === 'ready' && balanceState.snapshot.status === 'inactive';

  return {
    accountLabel: account.label.trim() || 'Stellar account',
    accountAddress: account.address,
    maskedAddress: maskAddress(account.address),
    accountKindLabel: isReadOnly ? (isClassic ? 'Read-only classic account' : 'Contract account') : 'Classic account',
    networkLabel: networkLabel(account.networkId),
    isReadOnly,
    canSend: isActive && !isReadOnly,
    canSwap: isActive && !isReadOnly && availability.swap,
    canRequest: availability.request,
    canManageAssets: isActive && !isReadOnly,
    canFundWithFriendbot: isInactive && availability.friendbot === true,
  };
}

export function maskAddress(value: string): string {
  return formatPublicAddress(value);
}

function networkLabel(networkId: string): string {
  if (networkId === 'stellar-testnet') {
    return 'Testnet';
  }
  if (networkId === 'stellar-mainnet') {
    return 'Mainnet';
  }
  return networkId;
}
