import React from 'react';
import { PassphrasePrompt } from '../../../ui/components/PassphrasePrompt/PassphrasePrompt';
let mockAuthorizing = false;
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useState: () => [
    mockAuthorizing,
    (v: boolean) => {
      mockAuthorizing = v;
    },
  ],
}));
beforeEach(() => {
  mockAuthorizing = false;
});

import type { PaymentReview } from '../../../capabilities/payment/buildPaymentReview';
import { SlideToConfirm } from '../../../ui/SlideToConfirm';
import { SendReviewScreen } from '../SendReviewScreen';

jest.mock('../../../ui/theme', () => {
  const actual = jest.requireActual('../../../ui/theme') as typeof import('../../../ui/theme');
  return {
    ...actual,
    useAppTheme: () => actual.defaultTheme,
    useThemedStyles: (factory: (theme: typeof actual.defaultTheme) => unknown) => factory(actual.defaultTheme),
  };
});

jest.mock('../../../locale', () => ({
  useLocalization: () => ({
    t: (key: string) =>
      ({
        'send.memo.type.none': 'None',
        'send.memo.type.text': 'Text',
        'send.authorization.passphraseRequired': 'localized:passphrase-required',
        'send.authorization.passphraseHint': 'localized:passphrase-hint',
        'send.authorization.slideToAuthorize': 'localized:slide-to-authorize',
        'send.authorization.appPassphrase': 'localized:app-passphrase',
      })[key] ?? key,
  }),
}));

type NodeProps = Readonly<{
  children?: React.ReactNode;
  accessibilityHint?: string;
  hint?: string;
  accessibilityLabel?: string;
  accessibilityLiveRegion?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  label?: string;
  loading?: boolean;
  mono?: boolean;
  value?: string;
}>;
function visit(node: React.ReactNode, callback: (element: React.ReactElement<NodeProps>) => void): void {
  if (!React.isValidElement<NodeProps>(node)) return;
  callback(node);
  React.Children.forEach(node.props.children, child => visit(child, callback));
}

const review: PaymentReview = {
  transactionXdrBase64: 'AAAA',
  networkId: 'testnet',
  source: 'GSOURCE',
  fee: '100',
  operation: 'payment',
  destination: 'GDESTINATION',
  amount: '1.0000000',
  asset: { kind: 'native' },
  memo: { type: 'text', value: 'hello' },
};

const baseProps: Parameters<typeof SendReviewScreen>[0] = {
  review,
  submitting: false,
  passphraseRequired: false,
  passphraseInput: { current: null },
  hasPassphrase: false,
  onPassphrasePresenceChange: jest.fn(),
  onConfirm: jest.fn(),
  onBack: jest.fn(),
};

function renderReview(overrides: Partial<Parameters<typeof SendReviewScreen>[0]> = {}) {
  return SendReviewScreen({ ...baseProps, ...overrides });
}
describe('SendReviewScreen authorization stages', () => {
  it('opens the password prompt only after the slide, and cancellation returns to review', () => {
    const inputRef = { current: { clear: jest.fn(), consume: jest.fn() } };
    let root = renderReview({ passphraseRequired: true, passphraseInput: inputRef });
    let slide: React.ReactElement<{ onComplete(): void }> | undefined;
    let prompt: React.ReactElement<Parameters<typeof PassphrasePrompt>[0]> | undefined;
    visit(root, e => {
      if (e.type === SlideToConfirm) slide = e as typeof slide;
      if (e.type === PassphrasePrompt) prompt = e as typeof prompt;
    });
    expect(prompt?.props.visible).toBe(false);
    slide?.props.onComplete();
    root = renderReview({ passphraseRequired: true, passphraseInput: inputRef });
    visit(root, e => {
      if (e.type === PassphrasePrompt) prompt = e as typeof prompt;
    });
    expect(prompt?.props.visible).toBe(true);
    expect(prompt?.props.inputRef).toBe(inputRef);
    prompt?.props.onCancel();
    expect(inputRef.current.clear).toHaveBeenCalled();
    expect(mockAuthorizing).toBe(false);
    expect(baseProps.onConfirm).not.toHaveBeenCalled();
  });

  it('labels Return distinctly from Hash while rendering the canonical transaction memo', () => {
    const memo = 'ab'.repeat(32);
    const root = renderReview({ review: { ...review, memo: { type: 'return', value: memo } } });
    let memoRow: React.ReactElement<NodeProps> | undefined;
    visit(root, element => {
      if (element.props.label === 'Memo') memoRow = element;
    });
    expect(memoRow?.props.value).toBe('send.memo.type.return · ' + memo);
    expect(memoRow?.props.value).not.toBe('send.memo.type.hash · ' + memo);
    expect(memoRow?.props.mono).toBe(true);
  });

  it('keeps the normal Send slide before passphrase fallback is required', () => {
    const root = renderReview();
    let input: React.ReactElement<NodeProps> | undefined;
    let slider: React.ReactElement<NodeProps> | undefined;

    visit(root, element => {
      if (element.type === SlideToConfirm) slider = element;
    });

    expect(input).toBeUndefined();
    expect(slider?.props.label).toBe('localized:slide-to-authorize');
    expect(slider?.props.disabled).toBe(false);
  });
});
