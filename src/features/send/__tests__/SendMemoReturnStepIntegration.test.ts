import { PassphrasePrompt } from '../../../ui/components/PassphrasePrompt/PassphrasePrompt';
import React, { useEffect, useRef, useState } from 'react';
import type { AccountRecord } from '@capabilities/account/types';
import { loadBalanceSnapshot } from '@capabilities/balance/loadBalanceSnapshot';
import type { PaymentReview } from '@capabilities/payment/buildPaymentReview';
import { buildRequestUri, parseRequestInput } from '@capabilities/request/requestUri';
import type { NetworkContext } from '@capabilities/network/types';
import type { BalanceLine } from '@capabilities/balance/types';
import { SendFlowScreen } from '../SendFlowScreen';
import { SendEntryScreen, SendFormScreen } from '../SendFormScreen';
import { SendEntryStatus } from '../SendEntryStatus';
import { SendReviewScreen } from '../SendReviewScreen';
import { buildSendReview, submitSendReview, type SendProductDependencies } from '../sendProductFlow';

jest.mock('@fresnica/ui-native', () => ({ Button: () => null }));
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useState: jest.fn(),
  useRef: jest.fn(),
  useEffect: jest.fn(),
  useCallback: (fn: unknown) => fn,
}));
jest.mock('../../../ui/theme', () => {
  const actual = jest.requireActual('../../../ui/theme');
  return { ...actual, useThemedStyles: (factory: (theme: unknown) => unknown) => factory(actual.defaultTheme) };
});
jest.mock('../../../locale', () => ({ useLocalization: () => ({ t: (key: string) => key }) }));
jest.mock('@capabilities/balance/loadBalanceSnapshot', () => ({ loadBalanceSnapshot: jest.fn() }));
jest.mock('../sendProductFlow', () => ({
  ...jest.requireActual('../sendProductFlow'),
  buildSendReview: jest.fn(),
  submitSendReview: jest.fn(),
}));

const network: NetworkContext = {
  id: 'stellar-testnet',
  networkPassphrase: 'Test SDF Network ; September 2015',
};
const account = {
  id: 'sender', networkId: network.id, address: 'GSOURCE', label: 'Source',
  identityKind: 'classic', hidden: false,
} as AccountRecord;
const dependencies = {
  network,
  gateway: {},
  repository: { isWatchOnly: () => false },
} as unknown as SendProductDependencies;
const destination = 'GDESTINATION';
const native = { kind: 'native' as const, code: 'XLM' as const };
const hex = 'ab'.repeat(32);

let values: unknown[] = [];
let references: { current: unknown }[] = [];
let stateIndex = 0;
let refIndex = 0;

function draw(intent: Parameters<typeof SendFlowScreen>[0]['requestIntent']) {
  stateIndex = 0;
  refIndex = 0;
  return SendFlowScreen({
    account, dependencies, requestIntent: intent, active: true, onDone: jest.fn(),
  });
}

function screen<T extends React.ElementType>(root: React.ReactNode, type: T): React.ReactElement<React.ComponentProps<T>> {
  const matches: React.ReactElement<React.ComponentProps<T>>[] = [];
  const walk = (node: React.ReactNode) => {
    if (!React.isValidElement(node)) return;
    if (node.type === type) matches.push(node as React.ReactElement<React.ComponentProps<T>>);
    React.Children.forEach((node.props as { children?: React.ReactNode }).children, walk);
  };
  walk(root);
  expect(matches).toHaveLength(1);
  return matches[0];
}

beforeEach(() => {
  jest.clearAllMocks();
  values = [];
  references = [];
  jest.mocked(useState).mockImplementation((initial?: unknown) => {
    const index = stateIndex++;
    if (!(index in values)) values[index] = initial;
    return [
      values[index],
      (next: unknown) => { values[index] = typeof next === 'function' ? next(values[index]) : next; },
    ] as ReturnType<typeof useState>;
  });
  jest.mocked(useRef).mockImplementation((initial?: unknown) => {
    const index = refIndex++;
    references[index] ??= { current: initial };
    return references[index] as ReturnType<typeof useRef>;
  });
  jest.mocked(loadBalanceSnapshot).mockResolvedValue({
    status: 'active', address: account.address,
    balances: [{ asset: native, balance: '10' }], hiddenLiquidityPoolShareCount: 0,
  });
  jest.mocked(buildSendReview).mockImplementation(async (_deps, _account, draft) => ({
    transactionXdrBase64: 'review-xdr-stub-not-a-native-transaction',
    networkId: network.id,
    source: account.address,
    fee: '100',
    operation: 'payment',
    destination: draft.destination,
    amount: '1.0000000',
    asset: { kind: 'native' },
    memo: draft.memo,
  } satisfies PaymentReview));
});

async function mount() {
  const uri = buildRequestUri({ isClassicAccountAddress: value => value === destination }, {
    destination, amount: '1',
    memo: { type: 'return', value: 'AB'.repeat(32) },
    message: 'Unverified public context',
    network,
  });
  const parsed = parseRequestInput({
    currentNetwork: network, isClassicAccountAddress: value => value === destination,
  }, uri);
  if (parsed.status !== 'accepted') throw new Error('expected validated SEP-7 pay intent');
  draw(parsed.intent);
  jest.mocked(useEffect).mock.calls[0][0]();
  for (let i = 0; i < 4; i++) await Promise.resolve();
  return parsed.intent;
}

describe('Merged #159 Memo Return with #162 staged Send', () => {
  it('keeps the first-step screen and replaces its loading content with the form', async () => {
    const loading = draw(undefined);
    expect(loading.type).toBe(SendEntryScreen);
    expect(screen(loading, SendEntryStatus).props.state.kind).toBe('loading');

    jest.mocked(useEffect).mock.calls[0][0]();
    for (let i = 0; i < 4; i++) await Promise.resolve();

    const loaded = draw(undefined);
    expect(loaded.type).toBe(loading.type);
    expect(loaded.key).toBe(loading.key);
    expect(screen(loaded, SendEntryScreen).props.onBack).toBeUndefined();
    expect(screen(loaded, SendFormScreen).props.step).toBe('details');
  });

  it('cancels the entry while balances are loading and ignores the late result', async () => {
    const loading = draw(undefined);
    jest.mocked(useEffect).mock.calls[0][0]();
    screen(loading, SendEntryScreen).props.onCancel();
    for (let i = 0; i < 4; i++) await Promise.resolve();

    expect(screen(draw(undefined), SendEntryStatus).props.state.kind).toBe('loading');
  });

  it('preserves validated SEP-7 Return through Details → Recipient → Summary → Back and edit', async () => {
    const intent = await mount();
    let form = screen(draw(intent), SendFormScreen);
    expect(form.props.step).toBe('details');
    expect(form.props.amount).toBe('1');
    form.props.onContinue();
    form = screen(draw(intent), SendFormScreen);
    expect(form.props.step).toBe('recipient');
    expect([form.props.destination, form.props.memoType, form.props.memoValue]).toEqual([
      destination, 'return', hex,
    ]);
    expect(form.props.requestMessage).toBe('Unverified public context');
    form.props.onContinue();
    for (let i = 0; i < 4; i++) await Promise.resolve();
    const review = screen(draw(intent), SendReviewScreen);
    expect(jest.mocked(buildSendReview)).toHaveBeenCalledWith(dependencies, account, {
      destination, amount: '1', asset: native, memo: { type: 'return', value: hex },
    });
    expect(review.props.review.memo).toEqual({ type: 'return', value: hex });
    expect(submitSendReview).not.toHaveBeenCalled();

    review.props.onBack();
    form = screen(draw(intent), SendFormScreen);
    expect(form.props.step).toBe('recipient');
    expect(form.props.memoType).toBe('return');
    form.props.onChangeMemoValue('cd'.repeat(32));
    form = screen(draw(intent), SendFormScreen);
    expect(form.props.memoType).toBe('return');
    expect(form.props.memoValue).toBe('cd'.repeat(32));
    form.props.onContinue();
    for (let i = 0; i < 4; i++) await Promise.resolve();
    expect(screen(draw(intent), SendReviewScreen).props.review.memo).toEqual({
      type: 'return', value: 'cd'.repeat(32),
    });
    expect(submitSendReview).not.toHaveBeenCalled();
  });

  it('clears a borrowed Return memo if an untouched request destination is manually changed', async () => {
    const intent = await mount();
    screen(draw(intent), SendFormScreen).props.onContinue();
    const recipient = screen(draw(intent), SendFormScreen);
    expect(recipient.props.memoType).toBe('return');
    recipient.props.onChangeDestination('GDIFFERENT');
    const edited = screen(draw(intent), SendFormScreen);
    expect(edited.props.destination).toBe('GDIFFERENT');
    expect([edited.props.memoType, edited.props.memoValue]).toEqual(['none', '']);
    expect(buildSendReview).not.toHaveBeenCalled();
  });
});


it('clears the entered amount when selecting an asset in Details', async () => {
  const intent = await mount();
  const form = screen(draw(intent), SendFormScreen);
  form.props.onSelectAsset(native);
  expect(screen(draw(intent), SendFormScreen).props.amount).toBe('');
  expect(buildSendReview).not.toHaveBeenCalled();
});

it.each([
  [{}, 'unknown'],
  [{ isAuthorized: false, isAuthorizedToMaintainLiabilities: true, sellingLiabilities: '0' }, 'maintain-liabilities'],
  [{ isAuthorized: true, sellingLiabilities: '2' }, 'no-available-balance'],
] as const)('blocks direct asset selection without losing the current draft: %s', async (fields, reason) => {
  const asset = { kind: 'credit', code: 'USD', issuer: 'GISSUER' } as const;
  const credit: BalanceLine = { asset, balance: '2', ...fields };
  jest.mocked(loadBalanceSnapshot).mockResolvedValue({
    status: 'active', address: account.address,
    balances: [{ asset: native, balance: '10' }, credit], hiddenLiquidityPoolShareCount: 0,
  });
  draw(undefined);
  jest.mocked(useEffect).mock.calls[0][0]();
  for (let i = 0; i < 4; i++) await Promise.resolve();
  screen(draw(undefined), SendFormScreen).props.onChangeAmount('3');
  screen(draw(undefined), SendFormScreen).props.onSelectAsset(asset);
  const form = screen(draw(undefined), SendFormScreen);
  expect(form.props.selectedAsset).toEqual(native);
  expect(form.props.amount).toBe('3');
  expect(form.props.error).toBe(`assets.availability.send.${reason}`);
  expect(buildSendReview).not.toHaveBeenCalled();
});

it('chooses an available default asset while keeping an unavailable first credit row visible', async () => {
  const credit: BalanceLine = { asset: { kind: 'credit', code: 'USD', issuer: 'GISSUER' }, balance: '2' };
  jest.mocked(loadBalanceSnapshot).mockResolvedValue({
    status: 'active', address: account.address,
    balances: [credit, { asset: native, balance: '10' }], hiddenLiquidityPoolShareCount: 0,
  });
  draw(undefined);
  jest.mocked(useEffect).mock.calls[0][0]();
  for (let i = 0; i < 4; i++) await Promise.resolve();
  const form = screen(draw(undefined), SendFormScreen);
  expect(form.props.selectedAsset).toEqual(native);
  expect(form.props.balances[0]).toEqual(credit);
  expect(buildSendReview).not.toHaveBeenCalled();
});

it('retires a busy Send on password-prompt expiry and ignores the deferred submission result', async () => {
  const intent = await mount();
  screen(draw(intent), SendFormScreen).props.onContinue();
  screen(draw(intent), SendFormScreen).props.onContinue();
  for (let i = 0; i < 4; i++) await Promise.resolve();
  const review = screen(draw(intent), SendReviewScreen);
  review.props.passphraseInput.current = { consume: jest.fn(() => 'legacy fixture password'), clear: jest.fn() };
  let complete!: (result: Awaited<ReturnType<typeof submitSendReview>>) => void;
  jest.mocked(submitSendReview).mockImplementationOnce(
    () =>
      new Promise(resolve => {
        complete = resolve;
      }),
  );
  review.props.onConfirm();
  const current = jest.mocked(submitSendReview).mock.calls[0][4]!;
  expect(current()).toBe(true);
  const busy = screen(draw(intent), SendReviewScreen);
  expect(busy.props.submitting).toBe(true);
  // Render the already-open child prompt; its timer callback must retire the parent's request.
  jest.mocked(useState).mockImplementationOnce(() => [true, jest.fn()] as ReturnType<typeof useState>);
  const prompt = screen(SendReviewScreen(busy.props), PassphrasePrompt);
  expect(prompt.props.visible).toBe(true);
  expect(prompt.props.busy).toBe(true);
  prompt.props.onExpire();
  expect(current()).toBe(false);
  expect(screen(draw(intent), SendFormScreen).props.step).toBe('recipient');
  complete({ status: 'uncertain', transactionHash: 'ORIGINAL_HASH', reason: 'pending-reconciliation' });
  for (let i = 0; i < 4; i++) await Promise.resolve();
  expect(screen(draw(intent), SendFormScreen).props.step).toBe('recipient');
  expect(submitSendReview).toHaveBeenCalledTimes(1);
  expect(current()).toBe(false);
});
