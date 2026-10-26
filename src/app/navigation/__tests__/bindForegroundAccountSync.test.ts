import type { AccountRecord } from '@capabilities/account/types';
import { createSwapSelectionStore } from '../swapSelectionStore';
import { bindForegroundAccountSync } from '../bindForegroundAccountSync';

const account = (id: string): AccountRecord => ({
  id,
  address: `G${id}`,
  networkId: 'testnet',
  identityKind: 'classic',
  label: id,
  hidden: false,
  sortOrder: 0,
  createdAt: new Date(0),
  updatedAt: new Date(0),
});
it('tracks committed selection across tabs, inventory changes, A→B→A and disposal', () => {
  const selection = createSwapSelectionStore();
  const setAccount = jest.fn();
  const accounts = [account('a'), account('b')];
  const network = { id: 'testnet', networkPassphrase: 'test' };
  selection.update({ selectedAccountId: 'a', accounts, network });
  const stop = bindForegroundAccountSync(selection, { setAccount });
  selection.update({ selectedAccountId: 'b', accounts, network });
  selection.update({ selectedAccountId: 'a', accounts, network });
  expect(setAccount.mock.calls.map(([value]) => value?.id)).toEqual(['a', 'b', 'a']);
  selection.update({ selectedAccountId: 'a', accounts: [], network });
  expect(setAccount).toHaveBeenLastCalledWith(undefined);
  selection.invalidate();
  stop();
  setAccount.mockClear();
  selection.update({ selectedAccountId: 'b', accounts, network });
  expect(setAccount).not.toHaveBeenCalled();
});
