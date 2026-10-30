import { createWalletSelectionPreferences } from '../createWalletSelectionPreferences';
import { InMemoryAccountSignerRepository } from '../../platform/persistence/memory/InMemoryAccountSignerRepository';
import type { AccountRecord } from '../../capabilities/account/types';

const now = new Date(0);
const first: AccountRecord = {
  id: 'a',
  address: 'GA',
  identityKind: 'classic',
  networkId: 'stellar-mainnet',
  label: 'A',
  sortOrder: 0,
  hidden: false,
  createdAt: now,
  updatedAt: now,
};
function setup() {
  const repository = new InMemoryAccountSignerRepository();
  repository.createAccount(first);
  repository.createAccount({ ...first, id: 'b', address: 'GB' });
  const saved = new Map<string, string>([
    ['stellar-mainnet', 'a'],
    ['stellar-testnet', 'b'],
  ]);
  const store = {
    getDefaultAccountId: (id: string) => saved.get(id),
    setDefaultAccountId: (id: string, account: string) => {
      saved.set(id, account);
    },
    clearDefaultAccountId: (id: string) => {
      saved.delete(id);
    },
  };
  return { repository, saved, preferences: createWalletSelectionPreferences(store, repository) };
}
describe('wallet selection independent of network details', () => {
  it('falls back to old per-network defaults until a selection is persisted, then retains the same identity', () => {
    const { preferences } = setup();
    expect(preferences.getDefaultAccountId('stellar-mainnet')).toBe('a');
    expect(preferences.getDefaultAccountId('stellar-testnet')).toBe('b');
    preferences.setDefaultAccountId('stellar-mainnet', 'a');
    expect(preferences.getDefaultAccountId('stellar-testnet')).toBe('a');
    preferences.setDefaultAccountId('stellar-testnet', 'b');
    expect(preferences.getDefaultAccountId('stellar-mainnet')).toBe('b');
  });
  it('does not restore hidden/deleted identities or move a contract into a different network', () => {
    const { preferences, repository } = setup();
    preferences.setDefaultAccountId('stellar-mainnet', 'a');
    repository.setAccountHidden('a', true, now);
    expect(preferences.getDefaultAccountId('stellar-testnet')).toBe('b');
    repository.deleteAccount('a');
    expect(preferences.getDefaultAccountId('stellar-testnet')).toBe('b');
    repository.createAccount({ ...first, id: 'c', address: 'CC', identityKind: 'contract' });
    preferences.setDefaultAccountId('stellar-mainnet', 'c');
    expect(preferences.getDefaultAccountId('stellar-mainnet')).toBe('c');
    expect(preferences.getDefaultAccountId('stellar-testnet')).toBe('b');
  });
});
