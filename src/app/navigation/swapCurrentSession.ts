import type { AccountRecord } from '../../capabilities/account/types';
import type { NetworkContext } from '../../capabilities/network/types';

type SwapSourceIdentity = Pick<AccountRecord, 'id' | 'address' | 'networkId' | 'identityKind'>;
type SwapVisibleIdentity = SwapSourceIdentity & Pick<AccountRecord, 'hidden'>;

export type SwapCurrentSelection = Readonly<{
  selectedAccountId: string;
  // Must increment at every App account-selection transition, including A→B→A.
  // Do not reconstruct this counter from the current selectedAccountId.
  selectionRevision: number;
  accounts: readonly SwapVisibleIdentity[];
  network: NetworkContext;
}>;

export function captureSwapCurrentSession(
  input: Readonly<{
    account: SwapSourceIdentity;
    network: NetworkContext;
    getCurrentSelection: () => SwapCurrentSelection | undefined;
    // Supply a captured route-focus EPOCH callback (e.g. from the existing
    // createRequestRouteFocusLifetime().capture()), not just isFocused().
    isCurrentFocusEpoch: () => boolean;
  }>,
): () => boolean {
  const expected = Object.freeze({
    id: input.account.id,
    address: input.account.address,
    networkId: input.account.networkId,
    identityKind: input.account.identityKind,
  });
  const expectedNetwork = Object.freeze({
    id: input.network.id,
    networkPassphrase: input.network.networkPassphrase,
  });
  let capturedRevision: number | undefined;
  let wasValidAtCapture = false;
  try {
    const current = input.getCurrentSelection();
    if (
      current &&
      Number.isSafeInteger(current.selectionRevision) &&
      current.selectionRevision >= 0 &&
      input.isCurrentFocusEpoch() &&
      matchesSelection(current, expected, expectedNetwork)
    ) {
      capturedRevision = current.selectionRevision;
      wasValidAtCapture = true;
    }
  } catch {
    // A stale/throwing App selector is not permission to sign.
  }

  return () => {
    if (!wasValidAtCapture) return false;
    try {
      if (!input.isCurrentFocusEpoch()) return false;
      const current = input.getCurrentSelection();
      return (
        current !== undefined &&
        current.selectionRevision === capturedRevision &&
        matchesSelection(current, expected, expectedNetwork)
      );
    } catch {
      return false;
    }
  };
}

function matchesSelection(
  current: SwapCurrentSelection,
  account: SwapSourceIdentity,
  network: NetworkContext,
): boolean {
  if (
    !current ||
    current.selectedAccountId !== account.id ||
    current.network?.id !== network.id ||
    current.network.networkPassphrase !== network.networkPassphrase ||
    account.networkId !== network.id ||
    account.identityKind !== 'classic' ||
    !Array.isArray(current.accounts)
  ) {
    return false;
  }
  let matches = 0;
  for (const item of current.accounts) {
    if (item.id !== account.id) continue;
    matches += 1;
    if (
      matches > 1 ||
      item.hidden ||
      item.address !== account.address ||
      item.networkId !== account.networkId ||
      item.identityKind !== account.identityKind
    ) {
      return false;
    }
  }
  return matches === 1;
}
