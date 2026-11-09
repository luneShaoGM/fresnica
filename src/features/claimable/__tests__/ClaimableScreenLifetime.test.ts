import React from 'react';
import type { AccountRecord } from '../../../capabilities/account/types';
import type { ClaimableProduct } from '../../../capabilities/claimable/createClaimableProduct';
import type {
  ClaimableReview,
  ClaimableTransactionDependencies,
} from '../../../capabilities/claimable/claimableTransaction';
import { submitClaimableReview } from '../../../capabilities/claimable/claimableTransaction';
import { ClaimableScreen } from '../ClaimableScreen';

let mockStateCursor = 0;
let mockBlur: (() => void) | undefined;
let mockActiveEffect: (() => void | (() => void)) | undefined;
let mockStateSetters: jest.Mock[] = [];
let mockFlow: { kind: 'review'; review: ClaimableReview };

jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useState: (initial: unknown) => {
    const index = mockStateCursor++;
    const setter = jest.fn((_next: unknown) => undefined);
    mockStateSetters[index] = setter;
    return [index === 9 ? mockFlow : typeof initial === 'function' ? (initial as () => unknown)() : initial, setter];
  },
  useRef: (initial: unknown) => ({ current: initial }),
  useCallback: (callback: unknown) => callback,
  useEffect: (effect: () => void | (() => void)) => {
    mockActiveEffect = effect;
  },
}));
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
  useFocusEffect: (callback: () => () => void) => {
    mockBlur = callback();
  },
}));
jest.mock('@ui/components', () => ({ Screen: () => null, BottomSheet: () => null }));
jest.mock('@ui/components/NativeButton', () => ({ NativeButton: () => null }));
jest.mock('../../../ui/SlideToConfirm', () => ({ SlideToConfirm: () => null }));
jest.mock('../../assets/TokenAssetIcon', () => ({ TokenAssetIcon: () => null }));
jest.mock('@ui/theme', () => {
  const actual = jest.requireActual('@ui/theme');
  return {
    ...actual,
    useAppTheme: () => actual.defaultTheme,
    useThemedStyles: (factory: (theme: unknown) => unknown) => factory(actual.defaultTheme),
  };
});
jest.mock('../../../locale', () => ({ useLocalization: () => ({ t: (key: string) => key }) }));
jest.mock('../../../capabilities/claimable/claimableTransaction', () => ({
  prepareClaimableReview: jest.fn(),
  submitClaimableReview: jest.fn(),
}));

const address = 'G' + 'A'.repeat(55);
const issuer = 'G' + 'B'.repeat(55);
const account: AccountRecord = {
  id: 'wallet-A',
  address,
  networkId: 'stellar-testnet',
  identityKind: 'classic',
  hidden: false,
  label: 'Account A',
  sortOrder: 0,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};
const creditReview: ClaimableReview = {
  id: '00000000' + 'a'.repeat(64),
  asset: { kind: 'credit', code: 'USD', issuer },
  amount: '3.0000000',
  source: address,
  sponsor: address,
  risk: 'SUSPECT',
  predicate: { unconditional: true },
  transactionXdrBase64: 'exact-reviewed-xdr',
  fee: '100',
  networkId: 'stellar-testnet',
};
const cached = () => ({
  stale: false,
  refreshFailed: false,
  snapshot: { networkId: 'stellar-testnet', address, savedAt: Date.now(), records: [] },
});
const product = {
  readCached: cached,
  refresh: jest.fn(async () => cached()),
  userSpam: () => undefined,
} as unknown as ClaimableProduct;
const transaction = {} as ClaimableTransactionDependencies;

function renderReview(isCurrentAccount: () => boolean = () => true) {
  mockStateCursor = 0;
  const tree = ClaimableScreen({
    account,
    product,
    transaction,
    active: true,
    canSign: true,
    invalidationRevision: 0,
    onBack: jest.fn(),
    onRecover: jest.fn(),
    isCurrentAccount,
  });
  const elements: React.ReactElement[] = [];
  const visit = (node: React.ReactNode): void => {
    React.Children.forEach(node, child => {
      if (!React.isValidElement(child)) return;
      elements.push(child);
      visit((child.props as { children?: React.ReactNode }).children);
    });
  };
  visit(tree);
  return elements;
}

describe('S11 Claimable final review and captured route lifetime', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFlow = { kind: 'review', review: creditReview };
    mockBlur = undefined;
    mockActiveEffect = undefined;
    mockStateSetters = [];
  });

  it('clears retired submission controls on a new foreground/focus activation', () => {
    renderReview();
    // A newly activated route with a reset load epoch must not keep a
    // suspended review, stale passphrase prompt or disabled submit slide.
    const cleanup = mockActiveEffect?.();
    expect(mockStateSetters[11]).toHaveBeenCalledWith(false);
    expect(mockStateSetters[12]).toHaveBeenCalledWith(false);
    const flowUpdater = mockStateSetters[9].mock.calls[0][0] as (previous: {
      kind: string;
      review?: ClaimableReview;
    }) => { kind: string };
    expect(flowUpdater({ kind: 'review', review: creditReview })).toEqual({ kind: 'list' });
    expect(flowUpdater({ kind: 'result' })).toEqual({ kind: 'result' });
    if (typeof cleanup === 'function') cleanup();
  });

  it('renders full issuer identity next to the credit asset before the final slide', () => {
    const elements = renderReview();
    expect(
      elements.some(
        element =>
          (element.props as { label?: string; value?: string }).label === 'claimable.asset' &&
          (element.props as { value?: string }).value === 'USD',
      ),
    ).toBe(true);
    expect(
      elements.some(
        element =>
          (element.props as { label?: string; value?: string }).label === 'claimable.issuer' &&
          (element.props as { value?: string }).value === issuer,
      ),
    ).toBe(true);
  });

  it('does not invent an issuer for native XLM', () => {
    mockFlow = { kind: 'review', review: { ...creditReview, asset: { kind: 'native', code: 'XLM' } } };
    const elements = renderReview();
    expect(elements.some(element => (element.props as { label?: string }).label === 'claimable.issuer')).toBe(false);
  });

  it('does not resurrect a cancelled review from a late slide-complete callback', () => {
    const elements = renderReview();
    const back = elements.find(
      element => (element.props as { accessibilityRole?: string }).accessibilityRole === 'button',
    );
    const slide = elements.find(element => (element.props as { label?: string }).label === 'claimable.slideToClaim');
    expect(back).toBeDefined();
    expect(slide).toBeDefined();
    (back!.props as { onPress: () => void }).onPress();
    (slide!.props as { onComplete: () => void }).onComplete();
    expect(submitClaimableReview).not.toHaveBeenCalled();
  });

  it('passes a live predicate to Claim even if the account or navigation focus changes after sliding', async () => {
    let selectedAccount = 'wallet-A';
    let complete!: (value: Awaited<ReturnType<typeof submitClaimableReview>>) => void;
    const pending = new Promise<Awaited<ReturnType<typeof submitClaimableReview>>>(resolve => {
      complete = resolve;
    });
    jest.mocked(submitClaimableReview).mockReturnValue(pending);
    const elements = renderReview(() => selectedAccount === 'wallet-A');
    const slide = elements.find(element => (element.props as { label?: string }).label === 'claimable.slideToClaim');
    expect(slide).toBeDefined();
    const onComplete = (slide!.props as { onComplete: () => void }).onComplete;
    onComplete();
    expect(submitClaimableReview).toHaveBeenCalledTimes(1);
    const isCurrent = jest.mocked(submitClaimableReview).mock.calls[0][4];
    expect(isCurrent()).toBe(true);

    selectedAccount = 'wallet-B';
    expect(isCurrent()).toBe(false);
    selectedAccount = 'wallet-A';
    expect(isCurrent()).toBe(true);
    // Blur must permanently invalidate this attempt even after returning
    // to the same account/focused route.
    expect(mockBlur).toBeDefined();
    mockBlur!();
    expect(isCurrent()).toBe(false);

    complete({ status: 'passphrase-required' });
    await Promise.resolve();
  });
});
