import type { AccountSignerRepository } from '../capabilities/account/AccountSignerRepository';
import type { AccountSelectionPreferenceStore } from './accountSelectionPreferences';

const WALLET_SELECTION_KEY = 'classic-wallet-selection';

export function createWalletSelectionPreferences(
  store: AccountSelectionPreferenceStore,
  repository: AccountSignerRepository,
): AccountSelectionPreferenceStore {
  return {
    getDefaultAccountId: networkId => {
      const selected = store.getDefaultAccountId(WALLET_SELECTION_KEY);
      const account = selected ? repository.getAccount(selected) : undefined;
      if (account && !account.hidden && (account.identityKind === 'classic' || account.networkId === networkId)) {
        return account.id;
      }
      return store.getDefaultAccountId(networkId);
    },
    setDefaultAccountId: (_networkId, accountId) => store.setDefaultAccountId(WALLET_SELECTION_KEY, accountId),
    clearDefaultAccountId: networkId => store.clearDefaultAccountId(networkId),
  };
}
