import type { AccountRecord } from '../../../capabilities/account/types';
import { captureSwapCurrentSession } from '../swapCurrentSession';
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
