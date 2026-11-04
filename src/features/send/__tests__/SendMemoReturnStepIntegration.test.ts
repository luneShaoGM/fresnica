import React, { useEffect, useRef, useState } from 'react';
import type { AccountRecord } from '@capabilities/account/types';
import { loadBalanceSnapshot } from '@capabilities/balance/loadBalanceSnapshot';
import type { PaymentReview } from '@capabilities/payment/buildPaymentReview';
import { buildRequestUri, parseRequestInput } from '@capabilities/request/requestUri';
import type { NetworkContext } from '@capabilities/network/types';
import { SendFlowScreen } from '../SendFlowScreen';
import { SendFormScreen } from '../SendFormScreen';
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
