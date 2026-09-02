import type {AccountRecord} from '../../capabilities/account/types';
import type {BalanceSnapshot} from '../../capabilities/balance/types';

export type HomeBalanceState =
  | Readonly<{kind: 'loading'}>
  | Readonly<{kind: 'error'; message: string}>
  | Readonly<{kind: 'ready'; snapshot: BalanceSnapshot}>;

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
}>;

type HomeAvailability = Readonly<{
  swap: boolean;
  request: boolean;
}>;

export function createHomeViewModel(
  account: AccountRecord,
  canSign: boolean,
  balanceState: HomeBalanceState,
  availability: HomeAvailability,
): HomeViewModel {
  const isClassic = account.identityKind === 'classic';
  const isReadOnly = !canSign || !isClassic;
  const isActive =
    balanceState.kind === 'ready' && balanceState.snapshot.status === 'active';

  return {
    accountLabel: account.label.trim() || 'Stellar account',
    accountAddress: account.address,
    maskedAddress: maskAddress(account.address),
    accountKindLabel: isReadOnly
      ? isClassic
        ? 'Read-only classic account'
        : 'Contract account'
      : 'Classic account',
    networkLabel: networkLabel(account.networkId),
    isReadOnly,
    canSend: isActive && !isReadOnly,
    canSwap: isActive && !isReadOnly && availability.swap,
    canRequest: availability.request,
    canManageAssets: isActive && !isReadOnly,
  };
}

export function maskAddress(value: string): string {
  if (value.length <= 20) {
    return value;
  }
  return `${value.slice(0, 9)}…${value.slice(-7)}`;
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
