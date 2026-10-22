import type { AccountRecord } from '../../../capabilities/account/types';
import { captureSwapCurrentSession } from '../swapCurrentSession';
import { createSwapSelectionStore } from '../swapSelectionStore';

const NETWORK = Object.freeze({ id: 'stellar-testnet', networkPassphrase: 'Test SDF Network ; September 2015' });
function account(id: string): AccountRecord {
  return {
    id,
    address: 'G' + id,
    networkId: NETWORK.id,
    identityKind: 'classic',
    hidden: false,
    sortOrder: 0,
    label: id,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
}
const A = account('A');
const B = account('B');

describe('MainTabs authoritative Swap selection epoch source', () => {
  it('increments for every actual A→B→A transition even without an intervening React render', () => {
    const store = createSwapSelectionStore();
    store.update({ selectedAccountId: A.id, accounts: [A, B], network: NETWORK });
    const first = store.getCurrentSelection()!;
    const guard = captureSwapCurrentSession({
      account: A,
      network: NETWORK,
      getCurrentSelection: store.getCurrentSelection,
      isCurrentFocusEpoch: () => true,
    });
    expect(guard()).toBe(true);
    store.update({ selectedAccountId: B.id, accounts: [A, B], network: NETWORK });
    store.update({ selectedAccountId: A.id, accounts: [A, B], network: NETWORK });
    expect(store.getCurrentSelection()?.selectionRevision).toBe(first.selectionRevision + 2);
    expect(guard()).toBe(false);
  });

  it('notifies mounted routes on committed transitions, including batched A→B→A', () => {
    const store = createSwapSelectionStore();
    const listener = jest.fn();
    const unsubscribe = store.subscribe(listener);
    store.update({ selectedAccountId: A.id, accounts: [A, B], network: NETWORK });
    store.update({ selectedAccountId: B.id, accounts: [A, B], network: NETWORK });
    store.update({ selectedAccountId: A.id, accounts: [A, B], network: NETWORK });
    expect(listener).toHaveBeenCalledTimes(3);
    store.update({ selectedAccountId: A.id, accounts: [{ ...A }, { ...B }], network: { ...NETWORK } });
    expect(listener).toHaveBeenCalledTimes(3);
    unsubscribe();
    store.invalidate();
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('does not invalidate an unchanged account snapshot because a fresh array was allocated', () => {
    const store = createSwapSelectionStore();
    store.update({ selectedAccountId: A.id, accounts: [A, B], network: NETWORK });
    const first = store.getCurrentSelection()!;
    store.update({ selectedAccountId: A.id, accounts: [{ ...A }, { ...B }], network: { ...NETWORK } });
    expect(store.getCurrentSelection()?.selectionRevision).toBe(first.selectionRevision);
  });

  it.each([
    ['hide', { ...A, hidden: true }],
    ['rebind address', { ...A, address: 'GOTHER' }],
    ['network change', { ...A, networkId: 'stellar-mainnet' }],
    ['contract transition', { ...A, identityKind: 'contract' as const }],
  ])('invalidates active session when selected account has %s', (_reason, mutated) => {
    const store = createSwapSelectionStore();
    store.update({ selectedAccountId: A.id, accounts: [A, B], network: NETWORK });
    const previous = store.getCurrentSelection()!;
    store.update({ selectedAccountId: A.id, accounts: [mutated, B], network: NETWORK });
    expect(store.getCurrentSelection()?.selectionRevision).toBeGreaterThan(previous.selectionRevision);
  });

  it('invalidates on network passphrase change or when selected account is deleted', () => {
    const store = createSwapSelectionStore();
    store.update({ selectedAccountId: A.id, accounts: [A, B], network: NETWORK });
    const first = store.getCurrentSelection()!;
    store.update({ selectedAccountId: A.id, accounts: [A, B], network: { ...NETWORK, networkPassphrase: 'OTHER' } });
    expect(store.getCurrentSelection()!.selectionRevision).toBeGreaterThan(first.selectionRevision);
    store.update({ selectedAccountId: A.id, accounts: [B], network: NETWORK });
    expect(store.getCurrentSelection()!.selectionRevision).toBeGreaterThan(first.selectionRevision + 1);
  });

  it('invalidates pending selectors on component unmount and never revives old generation', () => {
    const store = createSwapSelectionStore();
    store.update({ selectedAccountId: A.id, accounts: [A, B], network: NETWORK });
    const guard = captureSwapCurrentSession({
      account: A,
      network: NETWORK,
      getCurrentSelection: store.getCurrentSelection,
      isCurrentFocusEpoch: () => true,
    });
    expect(guard()).toBe(true);
    store.invalidate();
    expect(guard()).toBe(false);
    store.update({ selectedAccountId: A.id, accounts: [A, B], network: NETWORK });
    expect(guard()).toBe(false);
  });
});
