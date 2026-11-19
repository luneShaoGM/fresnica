import type { AccountRecord } from '../../../capabilities/account/types';
import { captureAccountSelectionSession, captureSwapCurrentSession } from '../swapCurrentSession';
import { createRequestRouteFocusLifetime } from '../requestContinueRouting';

const network = Object.freeze({ id: 'stellar-testnet', networkPassphrase: 'Test SDF Network ; September 2015' });
const account: AccountRecord = {
  id: 'wallet-a',
  address: 'GSOURCE',
  networkId: network.id,
  identityKind: 'classic',
  label: 'Account A',
  hidden: false,
  sortOrder: 0,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};
const other: AccountRecord = { ...account, id: 'wallet-b', address: 'GOTHER' };

it('allows public contract scans while keeping Swap Classic-only and retaining identity/revision guards', () => {
  const contract = { ...account, identityKind: 'contract' as const, address: 'CCONTRACT' };
  let selection = { selectedAccountId: contract.id, selectionRevision: 1, accounts: [contract], network };
  const input = { account: contract, network, getCurrentSelection: () => selection, isCurrentFocusEpoch: () => true };
  const scanned = captureAccountSelectionSession(input);
  expect(scanned()).toBe(true);
  expect(captureSwapCurrentSession(input)()).toBe(false);
  selection = { ...selection, selectionRevision: 3 };
  expect(scanned()).toBe(false);
  const current = captureAccountSelectionSession(input);
  selection = { ...selection, accounts: [{ ...contract, hidden: true }] };
  expect(current()).toBe(false);
});
function fixture() {
  const focus = createRequestRouteFocusLifetime();
  focus.focus();
  let selection: {
    selectedAccountId: string;
    selectionRevision: number;
    accounts: AccountRecord[];
    network: { id: string; networkPassphrase: string };
  } = {
    selectedAccountId: account.id,
    selectionRevision: 1,
    accounts: [account, other] as AccountRecord[],
    network,
  };
  const live = () => selection;
  const read = jest.fn(live);
  const isCurrentSession = captureSwapCurrentSession({
    account,
    network,
    getCurrentSelection: read,
    isCurrentFocusEpoch: focus.capture(),
  });
  return {
    isCurrentSession,
    read,
    focus,
    change(next: Partial<typeof selection>) {
      selection = { ...selection, ...next };
    },
  };
}

describe('Swap-D2a live App selection and focus-epoch guard', () => {
  it('accepts only a matching focused current Classic account, full network and selection revision', () => {
    const f = fixture();
    expect(f.isCurrentSession()).toBe(true);
    expect(f.read).toHaveBeenCalled();
  });

  it('rejects a selected-account switch even when the passed account record never mutated', () => {
    const f = fixture();
    f.change({ selectedAccountId: other.id, selectionRevision: 2 });
    expect(f.isCurrentSession()).toBe(false);
  });

  it('rejects A to B to A ABA selection, even after the original account ID is selected again', () => {
    const f = fixture();
    f.change({ selectedAccountId: other.id, selectionRevision: 2 });
    expect(f.isCurrentSession()).toBe(false);
    f.change({ selectedAccountId: account.id, selectionRevision: 3 });
    expect(f.isCurrentSession()).toBe(false);
  });

  it('rejects route blur/refocus and unmount lifetime without reviving old async attempts', () => {
    const f = fixture();
    f.focus.blur();
    expect(f.isCurrentSession()).toBe(false);
    f.focus.focus();
    expect(f.isCurrentSession()).toBe(false);
  });

  it.each([
    ['removed', []],
    ['hidden', [{ ...account, hidden: true }, other]],
    ['address rebound', [{ ...account, address: 'GOTHER2' }, other]],
    ['network rebound', [{ ...account, networkId: 'stellar-mainnet' }, other]],
    ['identity kind changed', [{ ...account, identityKind: 'contract' as const }, other]],
  ])('rejects %s selected source account from live account inventory', (_name, accounts) => {
    const f = fixture();
    f.change({ accounts });
    expect(f.isCurrentSession()).toBe(false);
  });

  it('rejects network ID and passphrase changes independently', () => {
    const f = fixture();
    f.change({ network: { ...network, networkPassphrase: 'wrong' } });
    expect(f.isCurrentSession()).toBe(false);
    const again = fixture();
    again.change({ network: { ...network, id: 'stellar-mainnet' } });
    expect(again.isCurrentSession()).toBe(false);
  });

  it('fails closed on selector read exceptions, missing snapshot, missing revision, duplicate ID', () => {
    const f = fixture();
    f.read.mockImplementation(() => {
      throw new Error('external store unavailable');
    });
    expect(f.isCurrentSession()).toBe(false);
    const empty = captureSwapCurrentSession({
      account,
      network,
      getCurrentSelection: () => undefined,
      isCurrentFocusEpoch: () => true,
    });
    expect(empty()).toBe(false);
    const duplicate = captureSwapCurrentSession({
      account,
      network,
      getCurrentSelection: () => ({
        selectedAccountId: account.id,
        selectionRevision: 1,
        accounts: [account, { ...account }],
        network,
      }),
      isCurrentFocusEpoch: () => true,
    });
    expect(duplicate()).toBe(false);
    const missingRevision = captureSwapCurrentSession({
      account,
      network,
      getCurrentSelection: () => ({
        selectedAccountId: account.id,
        selectionRevision: undefined as never,
        accounts: [account],
        network,
      }),
      isCurrentFocusEpoch: () => true,
    });
    expect(missingRevision()).toBe(false);
  });

  it('does not revive a blurred focus epoch when the caller replaces the original focus callback', () => {
    const focus = createRequestRouteFocusLifetime();
    focus.focus();
    const input = {
      account,
      network,
      getCurrentSelection: () => ({
        selectedAccountId: account.id,
        selectionRevision: 1,
        accounts: [account, other],
        network,
      }),
      isCurrentFocusEpoch: focus.capture(),
    };
    const guard = captureSwapCurrentSession(input);
    expect(guard()).toBe(true);
    focus.blur();
    expect(guard()).toBe(false);
    input.isCurrentFocusEpoch = () => true;
    expect(guard()).toBe(false);
    focus.focus();
    expect(guard()).toBe(false);
  });

  it('does not mask a live account switch when the caller replaces the selection getter with a stale snapshot', () => {
    let selection = {
      selectedAccountId: account.id,
      selectionRevision: 1,
      accounts: [account, other],
      network,
    };
    const original = () => selection;
    const input = {
      account,
      network,
      getCurrentSelection: original,
      isCurrentFocusEpoch: () => true,
    };
    const guard = captureSwapCurrentSession(input);
    expect(guard()).toBe(true);
    const staleSnapshot = selection;
    selection = { ...selection, selectedAccountId: other.id, selectionRevision: 2 };
    expect(guard()).toBe(false);
    input.getCurrentSelection = () => staleSnapshot;
    expect(guard()).toBe(false);
    selection = { ...selection, selectedAccountId: account.id, selectionRevision: 3 };
    expect(guard()).toBe(false);
  });

  it('keeps using the original live getter when the input callback is replaced after a valid capture', () => {
    const current = {
      selectedAccountId: account.id,
      selectionRevision: 1,
      accounts: [account, other],
      network,
    };
    const input = {
      account,
      network,
      getCurrentSelection: () => current,
      isCurrentFocusEpoch: () => true,
    };
    const guard = captureSwapCurrentSession(input);
    expect(guard()).toBe(true);
    input.getCurrentSelection = () => {
      throw new Error('replaced callback must not be used');
    };
    expect(guard()).toBe(true);
  });

  it('fails closed on invalid capture at route open, even if selection subsequently becomes valid', () => {
    const expected = { ...account };
    let selection = {
      selectedAccountId: other.id,
      selectionRevision: 1,
      accounts: [expected, other],
      network,
    };
    const guard = captureSwapCurrentSession({
      account,
      network,
      isCurrentFocusEpoch: () => true,
      getCurrentSelection: () => selection,
    });
    selection = { ...selection, selectedAccountId: account.id, selectionRevision: 2 };
    expect(guard()).toBe(false);
  });
});
