import React from 'react';
import { TextInput } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { maskRequestIssuer, RequestFormScreen } from '../RequestFormScreen';

jest.mock('react-native-qrcode-svg', () => ({
  __esModule: true,
  default: function QRCodeMock() {
    return null;
  },
}));

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
    t: (key: string, params?: Record<string, string>) => {
      if (key === 'request.qr.accessibility') return `qr:${params?.address}:${params?.uri}`;
      if (key === 'request.assetChoiceIssued') return `issued:${params?.code}:${params?.issuer}`;
      return key;
    },
  }),
}));

type NodeProps = Readonly<{
  children?: React.ReactNode;
  accessibilityLabel?: string;
  accessibilityState?: { selected?: boolean; disabled?: boolean };
  label?: string;
  disabled?: boolean;
  onPress?: () => void;
  keyboardType?: string;
  value?: string;
}>;

function visit(node: React.ReactNode, callback: (element: React.ReactElement<NodeProps>) => void): void {
  if (!React.isValidElement<NodeProps>(node)) return;
  callback(node);
  React.Children.forEach(node.props.children, child => visit(child, callback));
}

function renderForm(overrides: Partial<React.ComponentProps<typeof RequestFormScreen>> = {}) {
  const onCopy = jest.fn();
  const onShare = jest.fn();
  const onToggleQr = jest.fn();
  const canonicalUri = 'web+stellar:pay?destination=GDESTINATION&amount=1';
  const root = RequestFormScreen({
    accountLabel: 'Primary',
    accountAddress: 'GDESTINATION',
    assets: [{ kind: 'native' }, { kind: 'credit', code: 'usd', issuer: 'GISSUER' }],
    selectedAsset: { kind: 'native' },
    amountEnabled: true,
    amount: '1',
    memoType: 'id',
    memoValue: '7',
    message: 'Invoice',
    canonicalUri,
    qrVisible: true,
    busy: false,
    onSelectAsset: jest.fn(),
    onSetAmountEnabled: jest.fn(),
    onChangeAmount: jest.fn(),
    onSelectMemoType: jest.fn(),
    onChangeMemoValue: jest.fn(),
    onChangeMessage: jest.fn(),
    onCopy,
    onShare,
    onToggleQr,
    onCancel: jest.fn(),
    ...overrides,
  });
  return { root, onCopy, onShare, onToggleQr, canonicalUri };
}

describe('RequestFormScreen', () => {
  it('exposes amount, memo and message inputs with accessibility labels', () => {
    const { root } = renderForm();
    const inputs: React.ReactElement<NodeProps>[] = [];
    visit(root, element => {
      if (element.type === TextInput) inputs.push(element);
    });
    expect(inputs.map(input => input.props.accessibilityLabel)).toEqual([
      'request.amount.input',
      'request.memo.input.id',
      'request.message.input',
    ]);
    expect(inputs[0]?.props.keyboardType).toBe('decimal-pad');
    expect(inputs[1]?.props.keyboardType).toBe('number-pad');
  });

  it('distinguishes duplicate issued-asset codes visually and announces each exact issuer identity', () => {
    const issuerA = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const issuerB = 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
    const { root } = renderForm({
      assets: [
        { kind: 'native' },
        { kind: 'credit', code: 'USD', issuer: issuerA },
        { kind: 'credit', code: 'USD', issuer: issuerB },
      ],
      selectedAsset: { kind: 'credit', code: 'USD', issuer: issuerA },
    });
    const issuedLabels: string[] = [];
    const visibleText: string[] = [];

    visit(root, element => {
      if (element.props.accessibilityLabel?.startsWith('issued:USD:')) {
        issuedLabels.push(element.props.accessibilityLabel);
      }
      if (typeof element.props.children === 'string') {
        visibleText.push(element.props.children);
      }
    });

    expect(issuedLabels).toEqual([`issued:USD:${issuerA}`, `issued:USD:${issuerB}`]);
    expect(maskRequestIssuer(issuerA)).not.toBe(maskRequestIssuer(issuerB));
    expect(visibleText).toContain(maskRequestIssuer(issuerA));
    expect(visibleText).toContain(maskRequestIssuer(issuerB));
  });

  it('routes Copy, Share and QR actions without rebuilding request semantics', () => {
    const { root, onCopy, onShare, onToggleQr } = renderForm();
    const actions = new Map<string, React.ReactElement<NodeProps>>();
    visit(root, element => {
      if (['request.copy', 'request.share', 'request.qr.hide'].includes(element.props.label ?? '')) {
        actions.set(element.props.label ?? '', element);
      }
    });
    actions.get('request.copy')?.props.onPress?.();
    actions.get('request.share')?.props.onPress?.();
    actions.get('request.qr.hide')?.props.onPress?.();
    expect(onCopy).toHaveBeenCalledTimes(1);
    expect(onShare).toHaveBeenCalledTimes(1);
    expect(onToggleQr).toHaveBeenCalledTimes(1);
  });

  it('feeds the exact canonical URI to QR and exposes a textual accessibility alternative', () => {
    const { root, canonicalUri } = renderForm();
    let qr: React.ReactElement<{ value?: string }> | undefined;
    let qrContainer: React.ReactElement<NodeProps> | undefined;
    visit(root, element => {
      if (element.type === QRCode) qr = element as React.ReactElement<{ value?: string }>;
      if (element.props.accessibilityLabel?.startsWith('qr:')) qrContainer = element;
    });
    expect(qr?.props.value).toBe(canonicalUri);
    expect(qrContainer?.props.accessibilityLabel).toContain('GDESTINATION');
    expect(qrContainer?.props.accessibilityLabel).toContain(canonicalUri);
  });

  it('disables outbound actions when the canonical draft is invalid', () => {
    const { root } = renderForm({ canonicalUri: undefined, error: 'request.error.amount', qrVisible: false });
    const states: Array<{ disabled?: boolean }> = [];
    visit(root, element => {
      if (['request.copy', 'request.share', 'request.qr.show'].includes(element.props.label ?? '')) {
        states.push({ disabled: element.props.disabled });
      }
    });
    expect(states).toEqual([{ disabled: true }, { disabled: true }, { disabled: true }]);
  });
});
