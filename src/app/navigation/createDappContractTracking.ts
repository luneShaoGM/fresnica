import type { AccountSignerRepository } from '@capabilities/account/AccountSignerRepository';
import type { ContractAssets } from '@capabilities/assets/contractAssets';
import type { DappContractTracking } from '@capabilities/dapp-interaction/dappContractTracking';
import type { DappPublicSelection } from '@capabilities/dapp-interaction/freighterSession';

export function createDappContractTracking(
  registry: ContractAssets,
  repository: Pick<AccountSignerRepository, 'getAccount'>,
): DappContractTracking {
  const resolve = (selection: DappPublicSelection) => {
    const account = repository.getAccount(selection.accountId);
    if (
      !account ||
      account.hidden ||
      account.identityKind !== 'classic' ||
      account.address !== selection.address ||
      account.networkId !== selection.networkId ||
      registry.network.id !== selection.networkId ||
      registry.network.networkPassphrase !== selection.networkPassphrase
    )
      return undefined;
    return account;
  };
  return {
    canReview(selection, id) {
      try {
        return !!resolve(selection) && registry.isContractId(id);
      } catch {
        return false;
      }
    },
    async track(selection, id, signal, isCurrent) {
      const account = resolve(selection);
      if (!account || !isCurrent() || signal.aborted) return false;
      const record = await registry.track(account, id, signal, isCurrent);
      return (
        record.contractId === id &&
        record.networkId === selection.networkId &&
        record.accountAddress === selection.address
      );
    },
  };
}
