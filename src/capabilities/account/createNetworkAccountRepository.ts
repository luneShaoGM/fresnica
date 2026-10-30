import type { AccountSignerRepository } from './AccountSignerRepository';
import type { AccountRecord } from './types';

/** The stored network remains legacy provenance; Classic reads expose this session's explicit context. */
export function createNetworkAccountRepository(
  records: AccountSignerRepository,
  networkId: string,
): AccountSignerRepository {
  const context = (account: AccountRecord): AccountRecord =>
    account.identityKind === 'classic' ? { ...account, networkId } : account;
  const assertNewAccount = (account: AccountRecord) => {
    if (account.networkId !== networkId) throw new Error('network-mismatch');
    if (
      account.identityKind === 'classic' &&
      records
        .listAccounts()
        .some(candidate => candidate.identityKind === 'classic' && candidate.address === account.address)
    )
      throw new Error('duplicate-account-identity');
  };
  return {
    getAccount: id => {
      const account = records.getAccount(id);
      return account ? context(account) : undefined;
    },
    listAccounts: () => records.listAccounts().map(context),
    createAccount: account => {
      assertNewAccount(account);
      records.createAccount(account);
    },
    createAccountWithSigner: registration => {
      assertNewAccount(registration.account);
      records.createAccountWithSigner(registration);
    },
    createSigner: signer => records.createSigner(signer),
    upgradeWatchOnlyAccountWithSigner: registration => records.upgradeWatchOnlyAccountWithSigner(registration),
    attachSigner: (accountId, signerId, createdAt) => records.attachSigner(accountId, signerId, createdAt),
    detachSigner: (accountId, signerId) => records.detachSigner(accountId, signerId),
    deleteAccount: id => records.deleteAccount(id),
    getSigner: id => records.getSigner(id),
    listSigners: () => records.listSigners(),
    listSignersForAccount: id => records.listSignersForAccount(id),
    setAccountLabel: (id, label, updatedAt) => records.setAccountLabel(id, label, updatedAt),
    setAccountHidden: (id, hidden, updatedAt) => records.setAccountHidden(id, hidden, updatedAt),
    setAccountSortOrders: updates => records.setAccountSortOrders(updates),
    setSignerBackupState: (id, state, updatedAt) => records.setSignerBackupState(id, state, updatedAt),
    isWatchOnly: id => records.isWatchOnly(id),
  };
}
