import type { AccountRecord } from '../../capabilities/account/types';
import type { NetworkContext } from '../../capabilities/network/types';
import type { SwapCurrentSelection } from './swapCurrentSession';

type SelectionInput = Readonly<{
  selectedAccountId: string;
  accounts: readonly AccountRecord[];
  network: NetworkContext;
}>;

// The MainTabs selection owner updates at the actual selection commit
// boundary, not only when a React render catches up. A->B->A must consume
// two distinct revisions.
export function createSwapSelectionStore() {
  let revision = 0;
  let identity = '';
  let current: SwapCurrentSelection | undefined;
  const subscribers = new Set<() => void>();
  const subscribe = (listener: () => void) => {
    subscribers.add(listener);
    return () => subscribers.delete(listener);
  };

  const getCurrentSelection = (): SwapCurrentSelection | undefined => current;

  const update = ({ selectedAccountId, accounts, network }: SelectionInput): void => {
    const nextIdentity = [
      selectedAccountId,
      network.id,
      network.networkPassphrase,
      ...accounts.flatMap(account => [
        account.id,
        account.address,
        account.networkId,
        account.identityKind,
        account.hidden ? 'hidden' : 'visible',
      ]),
    ].join('|');
    if (identity === nextIdentity && current !== undefined) return;
    revision += 1;
    identity = nextIdentity;
    current = Object.freeze({
      selectedAccountId,
      selectionRevision: revision,
      accounts: Object.freeze([...accounts]),
      network: Object.freeze({ ...network }),
    });
    subscribers.forEach(listener => listener());
  };

  const invalidate = (): void => {
    revision += 1;
    identity = '';
    current = undefined;
    subscribers.forEach(listener => listener());
  };

  return Object.freeze({ getCurrentSelection, subscribe, update, invalidate });
}
