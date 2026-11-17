import React from 'react';
import { AppState, TextInput, type AppStateStatus } from 'react-native';
import { NativeButton } from '@ui/components/NativeButton';
import { PassphraseInput } from '@ui/components/PassphraseInput';
import { SlideToConfirm } from '@ui/SlideToConfirm';
import type { Markets } from '@capabilities/markets/createMarkets';
import type { MarketReview } from '@capabilities/markets/types';
import { account, pool, poolId, native, usd } from '@platform/stellar/__tests__/marketFixtures';
import { MarketsScreen } from '../MarketsScreen';

let mockState = 0,
  mockRef = 0;
let mockStates: unknown[] = [],
  mockRefs: { current: unknown }[] = [];
let mockEffects: (() => void | (() => void))[] = [];
let mockBlur: (() => void) | undefined;
let mockFocused = true;
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useState: (initial: unknown) => {
    const index = mockState++;
    if (!(index in mockStates))
      mockStates[index] = typeof initial === 'function' ? (initial as () => unknown)() : initial;
    return [
      mockStates[index],
      (next: unknown) => {
        mockStates[index] =
          typeof next === 'function' ? (next as (mockPrevious: unknown) => unknown)(mockStates[index]) : next;
      },
    ];
  },
  useRef: (initial: unknown) => {
    const index = mockRef++;
    return mockRefs[index] ?? (mockRefs[index] = { current: initial });
  },
  useCallback: (callback: unknown) => callback,
  useEffect: (effect: () => void | (() => void)) => {
    mockEffects.push(effect);
  },
}));
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => mockFocused,
  useFocusEffect: (callback: () => () => void) => {
    mockBlur = callback();
  },
}));
jest.mock('@ui/components', () => ({ Screen: () => null, AppModal: () => null }));
jest.mock('@ui/components/NativeButton', () => ({ NativeButton: () => null }));
jest.mock('@ui/components/PassphraseInput', () => ({ PassphraseInput: () => null }));
jest.mock('@ui/SlideToConfirm', () => ({ SlideToConfirm: () => null }));
jest.mock('../../../locale', () => ({ useLocalization: () => ({ t: (key: string) => key }) }));
jest.mock('@ui/theme', () => {
  const actual = jest.requireActual('@ui/theme');
  return {
    ...actual,
    useAppTheme: () => actual.defaultTheme,
    useThemedStyles: (factory: (theme: unknown) => unknown) => factory(actual.defaultTheme),
  };
});

type Node = React.ReactElement<Record<string, unknown>>;
function nodes(root: React.ReactNode): Node[] {
  const result: Node[] = [];
  React.Children.forEach(root, child => {
    if (!React.isValidElement<Record<string, unknown>>(child)) return;
    result.push(child);
    result.push(...nodes(child.props.children as React.ReactNode));
  });
  return result;
}
const review = {
  kind: 'exit',
  accountId: account.id,
  source: account.address,
  networkId: account.networkId,
  transactionXdrBase64: 'exact',
  fee: '100',
  operation: { type: 'exit', pool, shares: '5', minA: '9', minB: '19', close: false },
  facts: [
    { key: 'minimumA', value: '9' },
    { key: 'minimumB', value: '19' },
  ],
} as MarketReview;
const list = {
  balances: [
    { asset: { ...native, code: 'XLM' as const }, balance: '1000' },
    { asset: usd, balance: '1000' },
  ],
  offers: [],
  positions: [{ id: poolId, shares: '5', pool, underlyingA: '10', underlyingB: '20' }],
};
let product: Markets;
let prepare: jest.Mock, submit: jest.Mock, clear: jest.Mock;
let background: ((state: AppStateStatus) => void) | undefined;
function render(canSign = true) {
  mockState = 0;
  mockRef = 0;
  mockEffects = [];
  const result = nodes(
    MarketsScreen({
      account,
      product,
      kind: 'pools',
      active: true,
      canSign,
      invalidationRevision: 0,
      isCurrentAccount: () => true,
      onRecover: jest.fn(async () => undefined),
    }),
  );
  return result;
}
function button(tree: Node[], label: string) {
  return tree.find(node => node.type === NativeButton && node.props.label === label)!;
}
function press(node: Node) {
  (node.props.onPress as () => void)();
}
async function settle() {
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
}
async function openPosition() {
  render();
  mockEffects.forEach(effect => effect());
  await settle();
  const tree = render();
  const row = tree.find(
    node =>
      node.props.accessibilityRole === 'button' &&
      node.type !== NativeButton &&
      (node.props.children as unknown[])?.length === 3,
  )!;
  press(row);
  return render();
}
async function openReview() {
  const detail = await openPosition();
  press(button(detail, 'market.exit'));
  await settle();
  let tree = render();
  const field = tree.find(node => node.type === PassphraseInput)!;
  clear = jest.fn();
  (field.props.ref as { current: unknown }).current = { clear, consume: jest.fn(() => 'transient') };
  (field.props.onPresenceChange as (value: boolean) => void)(true);
  tree = render();
  return tree;
}
beforeEach(() => {
  mockStates = [];
  mockRefs = [];
  mockEffects = [];
  mockFocused = true;
  mockBlur = undefined;
  prepare = jest.fn(async () => review);
  submit = jest.fn(async () => ({ status: 'submitted', hash: 'hash' }));
  product = {
    networkId: account.networkId,
    list: jest.fn(async () => list),
    prepare,
    submit,
    outcome: () => 'uncertain',
  } as unknown as Markets;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => {
    background = callback;
    return { remove: jest.fn() };
  });
});
afterEach(() => jest.restoreAllMocks());

describe('S12 product lifetime and native input boundary', () => {
  it('resolves an explicit visible slippage and all/keep choice from LP detail before review', async () => {
    const tree = await openPosition();
    expect(
      tree.some(
        node =>
          node.type === TextInput && node.props.accessibilityLabel === 'market.slippage' && node.props.value === '50',
      ),
    ).toBe(true);
    press(button(tree, 'market.exit'));
    await settle();
    expect(prepare).toHaveBeenCalledWith(
      account.id,
      expect.objectContaining({ poolId, mode: 'all', slippageBps: 50, close: false }),
      expect.any(Function),
    );
  });
  it('keeps read-only withdrawal disabled', async () => {
    await openPosition();
    const tree = render(false);
    expect(button(tree, 'market.exit').props.disabled).toBe(true);
  });
  it('consumes the uncontrolled native field and submits only the exact reviewed object', async () => {
    const tree = await openReview();
    const slide = tree.find(node => node.type === SlideToConfirm)!;
    expect(slide.props.disabled).toBe(false);
    await (slide.props.onComplete as () => Promise<void>)();
    await settle();
    expect(submit).toHaveBeenCalledWith(review, 'transient', expect.any(Function));
    const field = tree.find(node => node.type === PassphraseInput)!;
    expect(field.props.value).toBeUndefined();
    expect(field.props.defaultValue).toBeUndefined();
  });
  it.each(['blur', 'background', 'unmount'])('retires a captured confirmation on %s before any submit', async cause => {
    const tree = await openReview();
    const slide = tree.find(node => node.type === SlideToConfirm)!;
    if (cause === 'blur') mockBlur?.();
    else if (cause === 'background') background?.('inactive');
    else {
      const cleanup = mockEffects[0]?.();
      if (typeof cleanup === 'function') cleanup();
    }
    (slide.props.onComplete as () => void)();
    await settle();
    expect(submit).not.toHaveBeenCalled();
    expect(clear).toHaveBeenCalled();
  });
  it('retires an already-running authorization and ignores its late result', async () => {
    const tree = await openReview();
    const slide = tree.find(node => node.type === SlideToConfirm)!;
    let resolve!: (value: unknown) => void;
    submit.mockReturnValueOnce(
      new Promise(done => {
        resolve = done;
      }),
    );
    (slide.props.onComplete as () => void)();
    const current = submit.mock.calls[0][2] as () => boolean;
    expect(current()).toBe(true);
    background?.('background');
    expect(current()).toBe(false);
    resolve({ status: 'submitted', hash: 'late' });
    await settle();
    expect(
      mockStates.some(value => !!value && typeof value === 'object' && 'kind' in value && value.kind === 'result'),
    ).toBe(false);
  });
});
