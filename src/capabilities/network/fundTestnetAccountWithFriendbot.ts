import type { AccountRecord } from '../account/types';
import type { FriendbotGatewayPort } from './FriendbotGateway';

const STELLAR_TESTNET_ID = 'stellar-testnet';

export type FriendbotDependencies = Readonly<{
  gateway: FriendbotGatewayPort;
  networkId: string;
}>;

export function isFriendbotFundingAvailable(dependencies: FriendbotDependencies, account: AccountRecord): boolean {
  return (
    account.networkId === dependencies.networkId &&
    dependencies.networkId === STELLAR_TESTNET_ID &&
    account.identityKind === 'classic'
  );
}

export async function fundTestnetAccountWithFriendbot(
  dependencies: FriendbotDependencies,
  account: AccountRecord,
): Promise<void> {
  if (account.networkId !== dependencies.networkId) {
    throw new Error(`friendbot-network-mismatch:${account.networkId}`);
  }
  if (dependencies.networkId !== STELLAR_TESTNET_ID) {
    throw new Error('friendbot-network-not-supported');
  }
  if (account.identityKind !== 'classic') {
    throw new Error('friendbot-account-not-supported');
  }

  await dependencies.gateway.fundAccount(account.address);
}
