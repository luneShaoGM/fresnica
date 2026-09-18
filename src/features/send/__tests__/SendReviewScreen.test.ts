import React from 'react';
import { Text, TextInput } from 'react-native';

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
  accessibilityLabel?: string;
  accessibilityLiveRegion?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  label?: string;
  loading?: boolean;
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
  appPassphrase: '',
  onChangePassphrase: jest.fn(),
  onConfirm: jest.fn(),
  onBack: jest.fn(),
};

function renderReview(overrides: Partial<Parameters<typeof SendReviewScreen>[0]> = {}) {
  return SendReviewScreen({ ...baseProps, ...overrides });
}
describe('SendReviewScreen authorization stages', () => {
  it('shows and focuses the App Passphrase stage after passphrase-required', () => {
    const root = renderReview({ passphraseRequired: true });
    let input: React.ReactElement<NodeProps> | undefined;
    let label: React.ReactElement<NodeProps> | undefined;
    let prompt: React.ReactElement<NodeProps> | undefined;
    let slider: React.ReactElement<NodeProps> | undefined;

    visit(root, element => {
      if (element.type === TextInput && element.props.accessibilityLabel === 'localized:app-passphrase') input = element;
      if (element.type === Text && element.props.children === 'localized:app-passphrase') label = element;
      if (
        element.type === Text &&
        element.props.children === 'localized:passphrase-required'
      ) {
        prompt = element;
      }
      if (element.type === SlideToConfirm) slider = element;
    });

    expect(input?.props.autoFocus).toBe(true);
    expect(label).toBeDefined();
    expect(input?.props.accessibilityHint).toBe('localized:passphrase-hint');
    expect(prompt?.props.accessibilityLiveRegion).toBe('assertive');
    expect(slider?.props.label).toBe('localized:slide-to-authorize');
    expect(slider?.props.disabled).toBe(true);
  });

  it('enables the second authorization slide only after a passphrase is entered', () => {
    const root = renderReview({ passphraseRequired: true, appPassphrase: 'test-passphrase' });
    let input: React.ReactElement<NodeProps> | undefined;
    let slider: React.ReactElement<NodeProps> | undefined;

    visit(root, element => {
      if (element.type === TextInput && element.props.accessibilityLabel === 'localized:app-passphrase') input = element;
      if (element.type === SlideToConfirm) slider = element;
    });

    expect(input?.props.value).toBe('test-passphrase');
    expect(slider?.props.label).toBe('localized:slide-to-authorize');
    expect(slider?.props.disabled).toBe(false);
  });

  it.each(['Authentication was cancelled.', 'System authentication failed. Try again.'])(
    'announces %s and restores the Send slide after authorization failure',
    error => {
      const root = renderReview({ error });
      let errorText: React.ReactElement<NodeProps> | undefined;
      let slider: React.ReactElement<NodeProps> | undefined;

      visit(root, element => {
        if (element.type === Text && element.props.children === error) errorText = element;
        if (element.type === SlideToConfirm) slider = element;
      });

      expect(errorText?.props.accessibilityLiveRegion).toBe('assertive');
      expect(slider?.props.disabled).toBe(false);
      expect(slider?.props.loading).toBe(false);
      expect(slider?.props.label).toBe('Slide to send');
    },
  );

  it('keeps the normal Send slide before passphrase fallback is required', () => {
    const root = renderReview();
    let input: React.ReactElement<NodeProps> | undefined;
    let slider: React.ReactElement<NodeProps> | undefined;

    visit(root, element => {
      if (element.type === TextInput && element.props.accessibilityLabel === 'localized:app-passphrase') input = element;
      if (element.type === SlideToConfirm) slider = element;
    });

    expect(input).toBeUndefined();
    expect(slider?.props.label).toBe('Slide to send');
    expect(slider?.props.disabled).toBe(false);
  });
});
