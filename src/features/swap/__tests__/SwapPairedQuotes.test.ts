import React from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { SlideToConfirm } from '../../../ui/SlideToConfirm';
import { submitSwapReview } from '../swapSubmissionProductFlow';
import type { AccountRecord } from '@capabilities/account/types';
import type { PathPaymentQuote, PreparedPathPaymentReview } from '@capabilities/path-payment/types';
import type { StellarPaymentAsset } from '@capabilities/stellar/types';
import { NativeButton } from '@ui/components/NativeButton';
import { SwapAmountInput } from '../SwapAmountInput';
import { SwapPreviewScreen } from '../SwapPreviewScreen';
import {
  loadSwapPreviewAssets,
  loadSwapSourceSpendable,
  prepareSwapPreviewReview,
  requestSwapPreviewQuotes,
} from '../swapPreviewProductFlow';

const mockT = (key: string) => key;
type Slot = { value?: unknown; deps?: readonly unknown[]; cleanup?: () => void };
let mockSlots: Slot[] = [];
let mockCursor = 0;
let mockEffects: Array<() => void> = [];
const mockSame = (a: readonly unknown[] | undefined, b: readonly unknown[]) =>
  a?.length === b.length && a.every((value, i) => Object.is(value, b[i]));
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useState: (initial: unknown) => {
    const i = mockCursor++;
    if (!mockSlots[i]) mockSlots[i] = { value: typeof initial === 'function' ? initial() : initial };
    return [
      mockSlots[i].value,
      (value: unknown) => {
        mockSlots[i].value = typeof value === 'function' ? value(mockSlots[i].value) : value;
      },
    ];
  },
  useRef: (initial: unknown) => {
    const i = mockCursor++;
    if (!mockSlots[i]) mockSlots[i] = { value: { current: initial } };
    return mockSlots[i].value;
  },
  useCallback: (fn: unknown, deps: readonly unknown[]) => {
    const i = mockCursor++;
    if (!mockSame(mockSlots[i]?.deps, deps)) mockSlots[i] = { value: fn, deps };
    return mockSlots[i].value;
  },
  useEffect: (effect: () => (() => void) | undefined, deps: readonly unknown[]) => {
    const i = mockCursor++;
    if (mockSame(mockSlots[i]?.deps, deps)) return;
    const previous = mockSlots[i]?.cleanup;
    mockSlots[i] = { deps };
    mockEffects.push(() => {
      previous?.();
      mockSlots[i].cleanup = effect();
    });
  },
}));
jest.mock('@fresnica/ui-native', () => ({ Button: () => null }));
jest.mock('../../../locale', () => ({ useLocalization: () => ({ t: mockT }) }));
jest.mock('../../../ui/theme', () => {
  const actual = jest.requireActual('../../../ui/theme');
  return { ...actual, useThemedStyles: (factory: (theme: unknown) => unknown) => factory(actual.defaultTheme) };
});
jest.mock('../swapPreviewProductFlow', () => ({
  loadSwapPreviewAssets: jest.fn(),
  loadSwapSourceSpendable: jest.fn(),
  requestSwapPreviewQuotes: jest.fn(),
  prepareSwapPreviewReview: jest.fn(),
}));
jest.mock('../swapSubmissionProductFlow', () => ({
  listSwapHistory: jest.fn(() => []),
  reconcileSwapPending: jest.fn(),
  submitSwapReview: jest.fn(),
}));
const load = jest.mocked(loadSwapPreviewAssets);
const spendable = jest.mocked(loadSwapSourceSpendable);
const request = jest.mocked(requestSwapPreviewQuotes);
const prepare = jest.mocked(prepareSwapPreviewReview);
const account = {
  id: 'a',
  address: 'GA',
  networkId: 'stellar-testnet',
  identityKind: 'classic',
  hidden: false,
  label: 'A',
} as AccountRecord;
const assets: readonly StellarPaymentAsset[] = [
  { kind: 'native' },
  { kind: 'credit', code: 'usd', issuer: 'GISSUER' },
  { kind: 'credit', code: 'EUR', issuer: 'GOTHER' },
];
function quote(source = '2.0000000', destination = '3.0000000'): PathPaymentQuote {
  return {
    sourceAmount: source,
    destinationAmount: destination,
    path: [],
    expiresAtUnixMs: 2_000_000_000_000,
  } as unknown as PathPaymentQuote;
}
function result(best = quote()) {
  return { quotes: [best], best };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
async function settle() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}
type NodeProps = {
  children?: React.ReactNode;
  label?: string;
  accessibilityLabel?: string;
  value?: string;
  disabled?: boolean;
  onChangeAmount?: (value: string) => void;
  onPress?: () => void;
  onComplete?: () => void;
  selected?: boolean;
  asset?: StellarPaymentAsset;
  style?: unknown;
};
function find(
  root: React.ReactNode,
  predicate: (node: React.ReactElement<NodeProps>) => boolean,
): React.ReactElement<NodeProps> | undefined {
  if (!React.isValidElement<NodeProps>(root)) return undefined;
  if (predicate(root)) return root;
  let found: React.ReactElement<NodeProps> | undefined;
  React.Children.forEach(root.props.children, child => {
    found ??= find(child, predicate);
  });
  return found;
}
function button(root: React.ReactNode, label: string) {
  const found = find(root, node => node.type === NativeButton && node.props.label === label);
  if (!found) throw new Error('missing-button:' + label);
  return found;
}
function input(root: React.ReactNode, side: 'pay' | 'receive') {
  const found = find(
    root,
    node => node.type === SwapAmountInput && node.props.accessibilityLabel === `swap.form.${side}Amount`,
  );
  if (!found) throw new Error('missing-input:' + side);
  return found;
}
function setup() {
  let session = 0;
  const props: React.ComponentProps<typeof SwapPreviewScreen> = {
    account,
    active: true,
    foreground: true,
    selectedAccountId: account.id,
    dependencies: {} as never,
    execution: {} as never,
    captureSession: () => {
      const current = session;
      return () => current === session;
    },
    onDone: jest.fn(),
    copyPublicText: jest.fn(),
    openExternalUrl: jest.fn(),
  };
  const draw = (changes: Partial<typeof props> = {}) => {
    Object.assign(props, changes);
    mockCursor = 0;
    const root = SwapPreviewScreen(props);
    const effects = mockEffects;
    mockEffects = [];
    effects.forEach(effect => effect());
    return root;
  };
  const mount = async () => {
    draw();
    await settle();
    return draw();
  };
  const dispose = () => mockSlots.forEach(slot => slot.cleanup?.());
  return {
    props,
    draw,
    mount,
    dispose,
    expire: () => {
      session++;
    },
  };
}
beforeEach(() => {
  jest.useFakeTimers();
  mockSlots = [];
  mockCursor = 0;
  mockEffects = [];
  load.mockReset().mockResolvedValue(assets);
  spendable.mockReset().mockResolvedValue('10.0000000');
  request.mockReset().mockResolvedValue(result());
  prepare.mockReset();
  jest.mocked(submitSwapReview).mockReset();
});
afterEach(() => {
  mockSlots.forEach(slot => slot.cleanup?.());
  jest.useRealTimers();
});

it('debounces rapid Pay edits into one exact strict-send request and projects Receive', async () => {
  const h = setup();
  let root = await h.mount();
  input(root, 'pay').props.onChangeAmount?.('1');
  root = h.draw();
  jest.advanceTimersByTime(300);
  input(root, 'pay').props.onChangeAmount?.('2');
  h.draw();
  jest.advanceTimersByTime(499);
  expect(request).not.toHaveBeenCalled();
  jest.advanceTimersByTime(1);
  await settle();
  root = h.draw();
  expect(request).toHaveBeenCalledTimes(1);
  expect(request.mock.calls[0][2]).toEqual({
    mode: 'strict_send',
    fixedAmount: '2',
    sourceAsset: assets[0],
    destinationAsset: assets[1],
  });
  expect(input(root, 'pay').props.value).toBe('2');
  expect(input(root, 'receive').props.value).toBe('3.0000000');
});
it('editing Receive fixes that amount and invalidates the old derived Pay value', async () => {
  const h = setup();
  let root = await h.mount();
  input(root, 'pay').props.onChangeAmount?.('2');
  h.draw();
  jest.advanceTimersByTime(500);
  await settle();
  root = h.draw();
  input(root, 'receive').props.onChangeAmount?.('8');
  root = h.draw();
  expect(input(root, 'pay').props.value).toBe('');
  expect(input(root, 'receive').props.value).toBe('8');
  request.mockResolvedValueOnce(result(quote('6.0000000', '8.0000000')));
  jest.advanceTimersByTime(500);
  await settle();
  root = h.draw();
  expect(request.mock.calls[1][2]).toMatchObject({ mode: 'strict_receive', fixedAmount: '8' });
  expect(input(root, 'pay').props.value).toBe('6.0000000');
  expect(input(root, 'receive').props.value).toBe('8');
});
it('manual quote consumes the debounce and a failure does not create a retry loop', async () => {
  const h = setup();
  let root = await h.mount();
  request.mockRejectedValueOnce(new Error('route_unavailable'));
  input(root, 'pay').props.onChangeAmount?.('2');
  root = h.draw();
  button(root, 'swap.preview.getQuotes').props.onPress?.();
  await settle();
  root = h.draw();
  jest.advanceTimersByTime(10_000);
  await settle();
  h.draw();
  expect(request).toHaveBeenCalledTimes(1);
  button(root, 'swap.preview.getQuotes').props.onPress?.();
  await settle();
  h.draw();
  expect(request).toHaveBeenCalledTimes(2);
});
it('keeps edits usable during a read and ignores obsolete completion without unlocking a newer request', async () => {
  const first = deferred<ReturnType<typeof result>>();
  const second = deferred<ReturnType<typeof result>>();
  request.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  const h = setup();
  let root = await h.mount();
  input(root, 'pay').props.onChangeAmount?.('2');
  h.draw();
  jest.advanceTimersByTime(500);
  root = h.draw();
  expect(input(root, 'pay').props.disabled).toBe(false);
  input(root, 'pay').props.onChangeAmount?.('4');
  h.draw();
  jest.advanceTimersByTime(500);
  first.resolve(result(quote('2', '99')));
  await settle();
  root = h.draw();
  expect(input(root, 'receive').props.value).toBe('');
  expect(button(root, 'swap.preview.loading').props.disabled).toBe(true);
  second.resolve(result(quote('4', '7')));
  await settle();
  root = h.draw();
  expect(input(root, 'pay').props.value).toBe('4');
  expect(input(root, 'receive').props.value).toBe('7');
});
it.each(['0', '-5', '1.23456789', '922337203685.4775808'])('never quotes invalid input %s', async value => {
  const h = setup();
  const root = await h.mount();
  input(root, 'pay').props.onChangeAmount?.(value);
  h.draw();
  jest.advanceTimersByTime(1000);
  expect(request).not.toHaveBeenCalled();
});
it('exchanges assets while clearing the economic amount and quote', async () => {
  const h = setup();
  let root = await h.mount();
  input(root, 'pay').props.onChangeAmount?.('2');
  h.draw();
  jest.advanceTimersByTime(500);
  await settle();
  root = h.draw();
  button(root, 'swap.form.exchangeAssets').props.onPress?.();
  root = h.draw();
  expect(input(root, 'pay').props.value).toBe('');
  expect(input(root, 'receive').props.value).toBe('');
  input(root, 'pay').props.onChangeAmount?.('4');
  h.draw();
  jest.advanceTimersByTime(500);
  await settle();
  expect(request.mock.calls[1][2]).toEqual({
    mode: 'strict_send',
    fixedAmount: '4',
    sourceAsset: assets[1],
    destinationAsset: assets[0],
  });
});
it('cancels backgrounded reads, refreshes on return and blocks late background results', async () => {
  const first = deferred<ReturnType<typeof result>>();
  request.mockReturnValueOnce(first.promise);
  const h = setup();
  let root = await h.mount();
  input(root, 'pay').props.onChangeAmount?.('2');
  h.draw();
  jest.advanceTimersByTime(500);
  h.draw({ foreground: false });
  first.resolve(result(quote('2', '99')));
  await settle();
  h.draw();
  jest.advanceTimersByTime(2000);
  expect(request).toHaveBeenCalledTimes(1);
  root = h.draw({ foreground: true });
  expect(input(root, 'receive').props.value).toBe('');
  jest.advanceTimersByTime(500);
  await settle();
  root = h.draw();
  expect(request).toHaveBeenCalledTimes(2);
  expect(input(root, 'receive').props.value).toBe('3.0000000');
});
it('clears debounce on close and on route/account lifetime disposal', async () => {
  const h = setup();
  let root = await h.mount();
  input(root, 'pay').props.onChangeAmount?.('2');
  root = h.draw();
  button(root, 'common.back').props.onPress?.();
  jest.advanceTimersByTime(500);
  expect(request).not.toHaveBeenCalled();
  input(root, 'pay').props.onChangeAmount?.('3');
  h.draw();
  h.expire();
  h.dispose();
  jest.advanceTimersByTime(500);
  expect(request).not.toHaveBeenCalled();
});
it('prepares only the explicitly selected quote and disables paired editing during preparation', async () => {
  const selected = quote('2', '3');
  request.mockResolvedValueOnce({ quotes: [selected], best: selected });
  const pending = deferred<PreparedPathPaymentReview>();
  prepare.mockReturnValueOnce(pending.promise);
  const h = setup();
  let root = await h.mount();
  input(root, 'pay').props.onChangeAmount?.('2');
  h.draw();
  jest.advanceTimersByTime(500);
  await settle();
  root = h.draw();
  button(root, 'swap.preview.review').props.onPress?.();
  root = h.draw();
  expect(prepare).toHaveBeenCalledWith(h.props.dependencies, account, selected, 100, expect.any(Function));
  expect(input(root, 'pay').props.disabled).toBe(true);
  expect(input(root, 'receive').props.disabled).toBe(true);
});

it('manual Requote after an existing quote does not leave a second automatic request armed', async () => {
  const h = setup();
  let root = await h.mount();
  input(root, 'pay').props.onChangeAmount?.('2');
  h.draw();
  jest.advanceTimersByTime(500);
  await settle();
  root = h.draw();
  const retry = deferred<ReturnType<typeof result>>();
  request.mockReturnValueOnce(retry.promise);
  button(root, 'swap.preview.requote').props.onPress?.();
  h.draw();
  retry.reject(new Error('offline'));
  await settle();
  h.draw();
  jest.advanceTimersByTime(2000);
  await settle();
  expect(request).toHaveBeenCalledTimes(2);
});

it('frames the selected quote summary with the route card layout and selected highlight', async () => {
  const h = setup();
  let root = await h.mount();
  input(root, 'pay').props.onChangeAmount?.('2');
  h.draw();
  jest.advanceTimersByTime(500);
  await settle();
  root = h.draw();
  const summary = find(root, node => node.type === View && Array.isArray(node.props.style));
  expect(summary).toBeDefined();
  const [base, selected] = summary?.props.style as ReadonlyArray<Record<string, unknown>>;
  expect(base).toMatchObject({ borderWidth: 1, paddingHorizontal: 14, paddingVertical: 14, gap: 6 });
  expect(selected).toHaveProperty('borderColor');
});

it('projects an alternate route and prepares that exact selected quote', async () => {
  const best = quote('2', '3');
  const alternate = quote('2', '4');
  request.mockResolvedValueOnce({ quotes: [best, alternate], best });
  prepare.mockReturnValueOnce(new Promise(() => undefined));
  const h = setup();
  let root = await h.mount();
  input(root, 'pay').props.onChangeAmount?.('2');
  h.draw();
  jest.advanceTimersByTime(500);
  await settle();
  root = h.draw();
  button(root, 'swap.settings.open').props.onPress?.();
  root = h.draw();
  const row = find(root, node => node.type === Pressable && node.key === '1');
  expect(row).toBeDefined();
  row?.props.onPress?.();
  root = h.draw();
  expect(input(root, 'pay').props.value).toBe('2');
  expect(input(root, 'receive').props.value).toBe('4');
  button(root, 'swap.preview.review').props.onPress?.();
  expect(prepare.mock.calls[0][2]).toBe(alternate);
});

it('invalidates the old pair on explicit asset selection and preserves issuer/code identity', async () => {
  const h = setup();
  let root = await h.mount();
  input(root, 'pay').props.onChangeAmount?.('2');
  h.draw();
  jest.advanceTimersByTime(500);
  await settle();
  root = h.draw();
  const choice = find(
    root,
    node => typeof node.type === 'function' && node.type.name === 'AssetChoice' && node.key === 'source-usd · GISSUER',
  );
  expect(choice).toBeDefined();
  choice?.props.onPress?.();
  root = h.draw();
  expect(input(root, 'receive').props.value).toBe('');
  jest.advanceTimersByTime(500);
  await settle();
  expect(request.mock.calls[1][2]).toMatchObject({
    sourceAsset: assets[1],
    destinationAsset: assets[2],
    fixedAmount: '2',
  });
});

it('clears the draft when a focus lifecycle reloads assets', async () => {
  const h = setup();
  let root = await h.mount();
  input(root, 'pay').props.onChangeAmount?.('2');
  h.draw();
  h.expire();
  h.draw({ active: false });
  h.draw({ active: true });
  await settle();
  root = h.draw();
  expect(input(root, 'pay').props.value).toBe('');
  expect(input(root, 'receive').props.value).toBe('');
  jest.advanceTimersByTime(1000);
  expect(request).not.toHaveBeenCalled();
});

it('preserves an explicitly authorized submission across System Auth background handoff', async () => {
  const reviewed = {
    transactionXdrBase64: 'UNSIGNED',
    networkId: account.networkId,
    source: account.address,
    destination: account.address,
    sourceAsset: assets[0],
    destinationAsset: assets[1],
    quotedSourceAmount: '2',
    quotedDestinationAmount: '3',
    path: [],
    mode: 'strict_send',
    sendAmount: '2',
    quote: quote(),
    destinationMinimum: '2.9',
    slippageBps: 100,
    fee: '100',
    expiresAtUnixSeconds: 2_000_000_000,
  } as PreparedPathPaymentReview;
  prepare.mockResolvedValueOnce(reviewed);
  const submitted = deferred<Awaited<ReturnType<typeof submitSwapReview>>>();
  jest.mocked(submitSwapReview).mockReturnValueOnce(submitted.promise);
  const h = setup();
  let root = await h.mount();
  input(root, 'pay').props.onChangeAmount?.('2');
  h.draw();
  jest.advanceTimersByTime(500);
  await settle();
  root = h.draw();
  button(root, 'swap.preview.review').props.onPress?.();
  await settle();
  root = h.draw();
  const slide = find(root, node => node.type === SlideToConfirm);
  expect(slide).toBeDefined();
  slide?.props.onComplete?.();
  h.draw({ foreground: false });
  submitted.resolve({ status: 'submitted', hash: 'original-hash', authorization: 'system-auth' });
  await settle();
  h.draw({ foreground: true });
  jest.advanceTimersByTime(1000);
  await settle();
  expect(submitSwapReview).toHaveBeenCalledTimes(1);
  expect(jest.mocked(submitSwapReview).mock.calls[0][2]).toBe(reviewed);
  expect(request).toHaveBeenCalledTimes(1);
  const terminal = h.draw();
  const resultView = find(terminal, node => typeof node.type === 'function' && node.type.name === 'SwapResultScreen');
  expect(resultView).toBeDefined();
});

it('ignores an already queued route tap while review preparation owns the request', async () => {
  const best = quote('2', '3');
  const alternate = quote('2', '4');
  request.mockResolvedValueOnce({ quotes: [best, alternate], best });
  prepare.mockReturnValueOnce(new Promise(() => undefined));
  const h = setup();
  let root = await h.mount();
  input(root, 'pay').props.onChangeAmount?.('2');
  h.draw();
  jest.advanceTimersByTime(500);
  await settle();
  root = h.draw();
  button(root, 'swap.settings.open').props.onPress?.();
  root = h.draw();
  const row = find(root, node => node.type === Pressable && node.key === '1');
  button(root, 'swap.preview.review').props.onPress?.();
  row?.props.onPress?.();
  root = h.draw();
  expect(input(root, 'receive').props.value).toBe('3');
  expect(input(root, 'receive').props.disabled).toBe(true);
  expect(prepare.mock.calls[0][2]).toBe(best);
});

it('opens Stellar-style swap settings, applies an explicit preset and closes without submitting', async () => {
  const h = setup();
  let root = await h.mount();
  input(root, 'pay').props.onChangeAmount?.('2');
  h.draw();
  jest.advanceTimersByTime(500);
  await settle();
  root = h.draw();
  expect(
    find(root, node => node.type === TextInput && node.props.accessibilityLabel === 'swap.settings.customSlippage'),
  ).toBeUndefined();
  button(root, 'swap.settings.open').props.onPress?.();
  root = h.draw();
  const preset = find(root, node => node.type === Pressable && node.key === '50');
  expect(preset).toBeDefined();
  preset?.props.onPress?.();
  root = h.draw();
  expect(
    find(root, node => node.type === TextInput && node.props.accessibilityLabel === 'swap.settings.customSlippage')
      ?.props.value,
  ).toBe('50');
  button(root, 'swap.settings.done').props.onPress?.();
  root = h.draw();
  expect(
    find(root, node => node.type === TextInput && node.props.accessibilityLabel === 'swap.settings.customSlippage'),
  ).toBeUndefined();
  expect(prepare).not.toHaveBeenCalled();
  expect(submitSwapReview).not.toHaveBeenCalled();
});

it('shows Pay spendable and refetches live ledger bounds before applying Max', async () => {
  const h = setup();
  let root = await h.mount();
  await settle();
  root = h.draw();
  expect(spendable).toHaveBeenCalledWith(h.props.dependencies, account, assets[0], expect.any(Function));
  spendable.mockResolvedValueOnce('8.9999900');
  button(root, 'swap.form.max').props.onPress?.();
  await settle();
  root = h.draw();
  expect(spendable).toHaveBeenCalledTimes(2);
  expect(input(root, 'pay').props.value).toBe('8.9999900');
  expect(input(root, 'receive').props.value).toBe('');
  jest.advanceTimersByTime(500);
  await settle();
  expect(request.mock.calls[0][2]).toMatchObject({
    mode: 'strict_send',
    fixedAmount: '8.9999900',
    sourceAsset: assets[0],
  });
  expect(prepare).not.toHaveBeenCalled();
  expect(submitSwapReview).not.toHaveBeenCalled();
});

it('does not overwrite newer Pay edit from a slow Max read', async () => {
  const h = setup();
  let root = await h.mount();
  await settle();
  root = h.draw();
  const pending = deferred<string | undefined>();
  spendable.mockReturnValueOnce(pending.promise);
  button(root, 'swap.form.max').props.onPress?.();
  root = h.draw();
  input(root, 'pay').props.onChangeAmount?.('3');
  h.draw();
  pending.resolve('9.0000000');
  await settle();
  root = h.draw();
  expect(input(root, 'pay').props.value).toBe('3');
  await settle();
  root = h.draw();
  expect(button(root, 'swap.form.max').props.disabled).toBe(false);
});

it('drops an old source Max result after a new asset and shows the new asset only', async () => {
  const h = setup();
  let root = await h.mount();
  await settle();
  root = h.draw();
  const pending = deferred<string | undefined>();
  spendable.mockReturnValueOnce(pending.promise);
  button(root, 'swap.form.max').props.onPress?.();
  root = h.draw();
  const choice = find(
    root,
    node => typeof node.type === 'function' && node.type.name === 'AssetChoice' && node.key === 'source-usd · GISSUER',
  );
  choice?.props.onPress?.();
  h.draw();
  await settle();
  pending.resolve('999.0000000');
  await settle();
  root = h.draw();
  expect(input(root, 'pay').props.value).toBe('');
  expect(spendable.mock.lastCall?.[2]).toEqual(assets[1]);
});

it('keeps Max disabled when the fresh balance read fails or has zero spendable', async () => {
  spendable.mockReset().mockRejectedValueOnce(new Error('offline'));
  const h = setup();
  let root = await h.mount();
  await settle();
  root = h.draw();
  expect(button(root, 'swap.form.max').props.disabled).toBe(true);
  spendable.mockResolvedValueOnce('0.0000000');
  button(root, 'swap.form.retrySpendable').props.onPress?.();
  h.draw();
  await settle();
  root = h.draw();
  expect(button(root, 'swap.form.max').props.disabled).toBe(true);
  expect(input(root, 'pay').props.value).toBe('');
});

it('does not allow a queued review or old route choice to run during a fresh Max read', async () => {
  const best = quote('2', '3');
  const alternative = quote('2', '4');
  request.mockResolvedValueOnce({ quotes: [best, alternative], best });
  const h = setup();
  let root = await h.mount();
  await settle();
  root = h.draw();
  input(root, 'pay').props.onChangeAmount?.('2');
  h.draw();
  jest.advanceTimersByTime(500);
  await settle();
  root = h.draw();
  button(root, 'swap.settings.open').props.onPress?.();
  root = h.draw();
  const oldRoute = find(root, node => node.type === Pressable && node.key === '1');
  const oldReview = button(root, 'swap.preview.review');
  const delayed = deferred<string | undefined>();
  spendable.mockReturnValueOnce(delayed.promise);
  button(root, 'swap.form.max').props.onPress?.();
  oldReview.props.onPress?.();
  oldRoute?.props.onPress?.();
  expect(prepare).not.toHaveBeenCalled();
  root = h.draw();
  expect(input(root, 'receive').props.value).toBe('3');
  delayed.resolve('7.5000000');
  await settle();
  root = h.draw();
  expect(input(root, 'pay').props.value).toBe('7.5000000');
  expect(prepare).not.toHaveBeenCalled();
});

it('switches explicitly edited Receive back to strict-send only after a successful Max read', async () => {
  const h = setup();
  let root = await h.mount();
  await settle();
  root = h.draw();
  input(root, 'receive').props.onChangeAmount?.('4');
  h.draw();
  jest.advanceTimersByTime(500);
  await settle();
  root = h.draw();
  expect(input(root, 'receive').props.value).toBe('4');
  spendable.mockResolvedValueOnce('6.1234567');
  button(root, 'swap.form.max').props.onPress?.();
  await settle();
  root = h.draw();
  expect(input(root, 'pay').props.value).toBe('6.1234567');
  expect(input(root, 'receive').props.value).toBe('');
  jest.advanceTimersByTime(500);
  await settle();
  expect(request.mock.lastCall?.[2]).toMatchObject({ mode: 'strict_send', fixedAmount: '6.1234567' });
});

it.each(['route', 'review', 'requote'] as const)(
  'ignores a pre-Max %s callback delivered after the fresh Max read has completed',
  async action => {
    const best = quote('2', '3');
    const alternate = quote('2', '4');
    request.mockResolvedValueOnce({ quotes: [best, alternate], best });
    prepare.mockReturnValueOnce(new Promise(() => undefined));
    const h = setup();
    let root = await h.mount();
    await settle();
    root = h.draw();
    input(root, 'pay').props.onChangeAmount?.('2');
    h.draw();
    jest.advanceTimersByTime(500);
    await settle();
    root = h.draw();
    button(root, 'swap.settings.open').props.onPress?.();
    root = h.draw();
    const oldRoute = find(root, node => node.type === Pressable && node.key === '1');
    expect(oldRoute).toBeDefined();
    const oldReview = button(root, 'swap.preview.review');
    const oldRequote = button(root, 'swap.preview.requote');
    spendable.mockResolvedValueOnce('7.5000000');
    button(root, 'swap.form.max').props.onPress?.();
    await settle();
    root = h.draw();
    expect(input(root, 'pay').props.value).toBe('7.5000000');
    expect(input(root, 'receive').props.value).toBe('');

    if (action === 'route') oldRoute?.props.onPress?.();
    if (action === 'review') oldReview.props.onPress?.();
    if (action === 'requote') oldRequote.props.onPress?.();
    await settle();
    root = h.draw();
    expect(input(root, 'pay').props.value).toBe('7.5000000');
    expect(input(root, 'receive').props.value).toBe('');
    expect(prepare).not.toHaveBeenCalled();
    expect(request).toHaveBeenCalledTimes(1);
    expect(submitSwapReview).not.toHaveBeenCalled();
  },
);

it('rejects a queued old Get Quotes callback after Max fills the new draft', async () => {
  const h = setup();
  let root = await h.mount();
  await settle();
  root = h.draw();
  input(root, 'pay').props.onChangeAmount?.('2');
  root = h.draw();
  const oldGetQuotes = button(root, 'swap.preview.getQuotes');
  jest.advanceTimersByTime(500);
  await settle();
  root = h.draw();
  spendable.mockResolvedValueOnce('7.5000000');
  button(root, 'swap.form.max').props.onPress?.();
  await settle();
  oldGetQuotes.props.onPress?.();
  await settle();
  root = h.draw();
  expect(input(root, 'pay').props.value).toBe('7.5000000');
  expect(input(root, 'receive').props.value).toBe('');
  expect(request).toHaveBeenCalledTimes(1);
  expect(prepare).not.toHaveBeenCalled();
});

it('rejects the previous selected route review callback but accepts the newly selected route review', async () => {
  const best = quote('2', '3');
  const alternate = quote('2', '4');
  request.mockResolvedValueOnce({ quotes: [best, alternate], best });
  prepare.mockReturnValueOnce(new Promise(() => undefined));
  const h = setup();
  let root = await h.mount();
  input(root, 'pay').props.onChangeAmount?.('2');
  h.draw();
  jest.advanceTimersByTime(500);
  await settle();
  root = h.draw();
  button(root, 'swap.settings.open').props.onPress?.();
  root = h.draw();
  const previousReview = button(root, 'swap.preview.review');
  const alternateRoute = find(root, node => node.type === Pressable && node.key === '1');
  expect(alternateRoute).toBeDefined();
  alternateRoute?.props.onPress?.();
  root = h.draw();
  expect(input(root, 'receive').props.value).toBe('4');
  previousReview.props.onPress?.();
  expect(prepare).not.toHaveBeenCalled();
  button(root, 'swap.preview.review').props.onPress?.();
  expect(prepare).toHaveBeenCalledTimes(1);
  expect(prepare.mock.calls[0][2]).toBe(alternate);
});

it.each(['review', 'route', 'requote'] as const)(
  'discards a pre-Requote %s callback delivered after the replacement quote fails',
  async action => {
    const best = quote('2', '3');
    const alternate = quote('2', '4');
    request.mockResolvedValueOnce({ quotes: [best, alternate], best });
    prepare.mockReturnValueOnce(new Promise(() => undefined));
    const h = setup();
    let root = await h.mount();
    input(root, 'pay').props.onChangeAmount?.('2');
    h.draw();
    jest.advanceTimersByTime(500);
    await settle();
    root = h.draw();
    button(root, 'swap.settings.open').props.onPress?.();
    root = h.draw();
    const oldReview = button(root, 'swap.preview.review');
    const oldRoute = find(root, node => node.type === Pressable && node.key === '1');
    const oldRequote = button(root, 'swap.preview.requote');
    expect(oldRoute).toBeDefined();

    request.mockRejectedValueOnce(new Error('offline'));
    oldRequote.props.onPress?.();
    await settle();
    root = h.draw();
    expect(input(root, 'pay').props.value).toBe('2');
    expect(input(root, 'receive').props.value).toBe('');
    expect(request).toHaveBeenCalledTimes(2);

    if (action === 'review') oldReview.props.onPress?.();
    if (action === 'route') oldRoute?.props.onPress?.();
    if (action === 'requote') oldRequote.props.onPress?.();
    await settle();
    root = h.draw();
    expect(input(root, 'pay').props.value).toBe('2');
    expect(input(root, 'receive').props.value).toBe('');
    expect(prepare).not.toHaveBeenCalled();
    expect(request).toHaveBeenCalledTimes(2);
  },
);

it('allows a new Get Quotes action after failed Requote without reviving the discarded quote', async () => {
  const oldQuote = quote('2', '3');
  const newQuote = quote('2', '5');
  request.mockResolvedValueOnce({ quotes: [oldQuote], best: oldQuote });
  const h = setup();
  let root = await h.mount();
  input(root, 'pay').props.onChangeAmount?.('2');
  h.draw();
  jest.advanceTimersByTime(500);
  await settle();
  root = h.draw();
  const oldReview = button(root, 'swap.preview.review');
  request.mockRejectedValueOnce(new Error('offline'));
  button(root, 'swap.preview.requote').props.onPress?.();
  await settle();
  root = h.draw();
  request.mockResolvedValueOnce({ quotes: [newQuote], best: newQuote });
  button(root, 'swap.preview.getQuotes').props.onPress?.();
  await settle();
  root = h.draw();
  expect(input(root, 'receive').props.value).toBe('5');
  oldReview.props.onPress?.();
  expect(prepare).not.toHaveBeenCalled();
  expect(request).toHaveBeenCalledTimes(3);
});
