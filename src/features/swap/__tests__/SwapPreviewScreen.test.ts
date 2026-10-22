import React from 'react';
import { Text } from 'react-native';
import type { AccountRecord } from '../../../capabilities/account/types';
import type { PreparedPathPaymentReview } from '../../../capabilities/path-payment/types';
import { NativeButton } from '../../../ui/components/NativeButton';
import { SlideToConfirm } from '../../../ui/SlideToConfirm';
import { TextInput } from 'react-native';

jest.mock('@fresnica/ui-native', () => ({ Button: () => null, Screen: () => null }));
jest.mock('../swapSubmissionProductFlow', () => ({
  submitSwapReview: jest.fn(),
  listSwapHistory: jest.fn(() => []),
  reconcileSwapPending: jest.fn(),
}));
jest.mock('../../../locale', () => ({
  useLocalization: () => ({ t: (key: string) => key }),
}));
jest.mock('../../../ui/theme', () => {
  const actual = jest.requireActual('../../../ui/theme') as typeof import('../../../ui/theme');
  return {
    ...actual,
    useThemedStyles: (factory: (theme: typeof actual.defaultTheme) => unknown) => factory(actual.defaultTheme),
  };
});

const react = jest.requireActual<typeof import('react')>('react');
const stateSlots: Array<{ current: unknown }> = [];
const refSlots: Array<{ current: unknown }> = [];
let stateCursor = 0;
let refCursor = 0;
jest.spyOn(react, 'useState').mockImplementation(((initial: unknown) => {
  const index = stateCursor++;
  if (!stateSlots[index])
    stateSlots[index] = { current: typeof initial === 'function' ? (initial as () => unknown)() : initial };
  return [
    stateSlots[index].current,
    (value: unknown) => {
      const current = stateSlots[index].current;
      stateSlots[index].current = typeof value === 'function' ? (value as (prev: unknown) => unknown)(current) : value;
    },
  ];
}) as typeof react.useState);
jest.spyOn(react, 'useRef').mockImplementation(((initial: unknown) => {
  const index = refCursor++;
  if (!refSlots[index]) refSlots[index] = { current: initial };
  return refSlots[index];
}) as typeof react.useRef);
jest.spyOn(react, 'useEffect').mockImplementation((() => undefined) as typeof react.useEffect);
jest.spyOn(react, 'useCallback').mockImplementation(((callback: unknown) => callback) as typeof react.useCallback);

const { SwapPreviewScreen } = require('../SwapPreviewScreen') as typeof import('../SwapPreviewScreen');
const { submitSwapReview, listSwapHistory } = require('../swapSubmissionProductFlow') as jest.Mocked<
  typeof import('../swapSubmissionProductFlow')
>;
const account: AccountRecord = {
  id: 'a',
  address: 'GSOURCE',
  networkId: 'stellar-testnet',
  identityKind: 'classic',
  hidden: false,
  label: 'Main',
  sortOrder: 0,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};
const issued = { kind: 'credit' as const, code: 'USD', issuer: 'GISSUER' };
const review = {
  transactionXdrBase64: 'UNSIGNED',
  networkId: account.networkId,
  source: account.address,
  destination: account.address,
  sourceAsset: { kind: 'native' },
  destinationAsset: issued,
  quotedSourceAmount: '5.0000000',
  quotedDestinationAmount: '10.0000000',
  path: [issued],
  quote: { request: { mode: 'strict_send' } },
  mode: 'strict_send',
  sendAmount: '5.0000000',
  destinationMinimum: '9.9000000',
  slippageBps: 100,
  fee: '100',
  expiresAtUnixSeconds: 1782000180,
} as unknown as PreparedPathPaymentReview;

type NodeProps = Readonly<{
  children?: React.ReactNode;
  value?: string;
  label?: string;
  onPress?: () => void;
  onComplete?: () => void;
  secureTextEntry?: boolean;
  disabled?: boolean;
}>;
function visit(node: React.ReactNode, callback: (element: React.ReactElement<NodeProps>) => void): void {
  if (!React.isValidElement<NodeProps>(node)) return;
  callback(node);
  React.Children.forEach(node.props.children, item => visit(item, callback));
}
function render(overrides: Partial<React.ComponentProps<typeof SwapPreviewScreen>> = {}) {
  stateCursor = 0;
  refCursor = 0;
  return SwapPreviewScreen({
    account,
    active: true,
    selectedAccountId: account.id,
    dependencies: {} as never,
    execution: {} as never,
    captureSession: () => () => true,
    onDone: jest.fn(),
    ...overrides,
  });
}
beforeEach(() => {
  stateSlots.length = 0;
  refSlots.length = 0;
  submitSwapReview.mockReset();
  listSwapHistory.mockReset().mockReturnValue([]);
});

describe('Swap Preview user-visible scope', () => {
  it('shows the disabled-execution disclosure and only a quote action in the form', () => {
    render();
    stateSlots[0].current = [{ kind: 'native' }, issued];
    stateSlots[1].current = false;
    stateSlots[6].current = '5';
    const root = render();
    const buttons: string[] = [];
    const texts: unknown[] = [];
    visit(root, node => {
      if (node.type === NativeButton) buttons.push(node.props.label ?? '');
      if (node.type === Text) texts.push(node.props.children);
    });
    expect(buttons).toContain('swap.preview.getQuotes');
    expect(buttons).not.toContain('swap.preview.review');
    expect(texts).toContain('swap.execution.safePreview');
  });

  it('shows exact reviewed XDR with explicit slide authorization and no tap-to-send button', () => {
    render();
    stateSlots[0].current = [{ kind: 'native' }, issued];
    stateSlots[1].current = false;
    stateSlots[8].current = { kind: 'review', review };
    const root = render();
    const buttons: string[] = [];
    const texts: unknown[] = [];
    const values: string[] = [];
    const slides: string[] = [];
    visit(root, node => {
      if (node.type === NativeButton) buttons.push(node.props.label ?? '');
      if (node.type === SlideToConfirm) slides.push(node.props.label ?? '');
      if (node.type === Text) texts.push(node.props.children);
      if (typeof node.props.value === 'string') values.push(node.props.value);
    });
    expect(slides).toEqual(['swap.execution.slide']);
    expect(buttons).not.toContain('swap.preview.done');
    expect(buttons).not.toContain('swap.preview.review');
    expect(buttons).not.toContain('swap.preview.getQuotes');
    expect(texts).toContain('swap.execution.authorizationNotice');
    expect(values).toContain('USD · GISSUER');
    expect(values).toContain('9.9000000');
    expect(values).toContain('100');
  });

  it('requires a secure app passphrase and another explicit slide when System Auth fallback is requested', () => {
    render();
    stateSlots[1].current = false;
    stateSlots[8].current = { kind: 'review', review };
    stateSlots[11].current = true;
    stateSlots[12].current = 'password';
    const root = render();
    let secureInput: React.ReactElement<NodeProps> | undefined;
    let slide: React.ReactElement<NodeProps> | undefined;
    visit(root, node => {
      if (node.type === TextInput && node.props.secureTextEntry === true) secureInput = node;
      if (node.type === SlideToConfirm) slide = node;
    });
    expect(secureInput?.props.value).toBe('password');
    expect(slide?.props.label).toBe('swap.execution.slidePassphrase');
  });

  it('shows uncertain transaction hash without offering a second submit after broadcast uncertainty', () => {
    render();
    stateSlots[1].current = false;
    stateSlots[8].current = {
      kind: 'result',
      result: {
        status: 'uncertain',
        transactionHash: 'hash-unknown',
        reason: 'pending-reconciliation',
      },
    };
    const root = render();
    const texts: unknown[] = [];
    const slides: string[] = [];
    const values: string[] = [];
    visit(root, node => {
      if (node.type === Text) texts.push(node.props.children);
      if (node.type === SlideToConfirm) slides.push(node.props.label ?? '');
      if (typeof node.props.value === 'string') values.push(node.props.value);
    });
    expect(texts).toContain('swap.result.uncertain');
    expect(values).toContain('hash-unknown');
    expect(slides).toEqual([]);
  });

  it('blocks the confirmation slide while a prior same-account Swap is unresolved', () => {
    render();
    stateSlots[1].current = false;
    stateSlots[8].current = { kind: 'review', review };
    stateSlots[14].current = [
      {
        id: 'stellar-testnet:hash-pending',
        accountId: account.id,
        networkId: account.networkId,
        sourceAddress: account.address,
        transactionHash: 'hash-pending',
        intentKind: 'path-payment',
        intentKey: 'swap:1',
        state: 'uncertain',
        updatedAt: new Date(0),
        createdAt: new Date(0),
      },
    ];
    const root = render();
    let slide: React.ReactElement<NodeProps> | undefined;
    const labels: string[] = [];
    visit(root, node => {
      if (node.type === SlideToConfirm) slide = node;
      if (node.type === NativeButton) labels.push(node.props.label ?? '');
    });
    expect(slide?.props.disabled).toBe(true);
    expect(labels).toContain('swap.history.check');
  });

  it('shows persisted terminal Swap status on reopened form without recreating a transaction', () => {
    render();
    stateSlots[1].current = false;
    stateSlots[14].current = [
      {
        id: 'stellar-testnet:hash-confirmed',
        accountId: account.id,
        networkId: account.networkId,
        sourceAddress: account.address,
        transactionHash: 'hash-confirmed',
        intentKind: 'path-payment',
        intentKey: 'swap:2',
        state: 'confirmed',
        updatedAt: new Date(0),
        createdAt: new Date(0),
        ledger: 74,
      },
    ];
    const root = render();
    const texts: unknown[] = [];
    const slides: string[] = [];
    visit(root, node => {
      if (node.type === Text) texts.push(node.props.children);
      if (node.type === SlideToConfirm) slides.push(node.props.label ?? '');
    });
    expect(texts).toContain('swap.history.state.confirmed');
    expect(texts).toContain('hash-confirmed');
    expect(slides).toEqual([]);
  });

  it('calls reviewed D1 once even if the authorization slide callback fires twice rapidly', async () => {
    submitSwapReview.mockResolvedValue({ status: 'submitted', authorization: 'system-auth', hash: 'sent-hash' });
    render();
    stateSlots[1].current = false;
    stateSlots[8].current = { kind: 'review', review };
    const root = render();
    let slide: React.ReactElement<NodeProps> | undefined;
    visit(root, node => {
      if (node.type === SlideToConfirm) slide = node;
    });
    const first = slide?.props.onComplete?.();
    const second = slide?.props.onComplete?.();
    await Promise.all([first, second]);
    expect(submitSwapReview).toHaveBeenCalledTimes(1);
    expect(submitSwapReview).toHaveBeenCalledWith(expect.anything(), account, review, expect.any(Function), undefined);
    expect(stateSlots[8].current).toMatchObject({
      kind: 'result',
      result: { status: 'submitted', hash: 'sent-hash' },
    });
  });

  it('keeps the same reviewed transaction across System Auth fallback and a second explicit slide', async () => {
    submitSwapReview
      .mockResolvedValueOnce({ status: 'passphrase-required' })
      .mockResolvedValueOnce({ status: 'submitted', authorization: 'passphrase', hash: 'signed-hash' });
    render();
    stateSlots[1].current = false;
    stateSlots[8].current = { kind: 'review', review };
    let slide: React.ReactElement<NodeProps> | undefined;
    visit(render(), node => {
      if (node.type === SlideToConfirm) slide = node;
    });
    await slide?.props.onComplete?.();
    expect(stateSlots[11].current).toBe(true);
    stateSlots[12].current = 'password';
    visit(render(), node => {
      if (node.type === SlideToConfirm) slide = node;
    });
    expect(slide?.props.label).toBe('swap.execution.slidePassphrase');
    await slide?.props.onComplete?.();
    expect(submitSwapReview).toHaveBeenCalledTimes(2);
    expect(submitSwapReview).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      account,
      review,
      expect.any(Function),
      undefined,
    );
    expect(submitSwapReview).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      account,
      review,
      expect.any(Function),
      'password',
    );
    expect(stateSlots[12].current).toBe('');
    expect(stateSlots[8].current).toMatchObject({ kind: 'result', result: { status: 'submitted' } });
  });

  it('never mislabels an accepted broadcast as a submission error when local history reading fails', async () => {
    submitSwapReview.mockResolvedValue({ status: 'submitted', authorization: 'system-auth', hash: 'confirmed-hash' });
    listSwapHistory.mockImplementationOnce(() => {
      throw new Error('realm-read-unavailable');
    });
    render();
    stateSlots[1].current = false;
    stateSlots[8].current = { kind: 'review', review };
    let slide: React.ReactElement<NodeProps> | undefined;
    visit(render(), node => {
      if (node.type === SlideToConfirm) slide = node;
    });
    await slide?.props.onComplete?.();
    expect(stateSlots[8].current).toMatchObject({
      kind: 'result',
      result: { status: 'submitted', hash: 'confirmed-hash' },
    });
    expect(stateSlots[9].current).toBeUndefined();
    expect(stateSlots[15].current).toBe('swap.error.historyUnavailable');
  });

  it('does not show form or review actions when the external selected account differs', () => {
    const root = render({ selectedAccountId: 'other' });
    const buttons: string[] = [];
    visit(root, node => {
      if (node.type === NativeButton) buttons.push(node.props.label ?? '');
    });
    expect(buttons).toEqual(['common.back']);
  });
});
