import React from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Screen } from '@ui/components';
import { NativeButton } from '@ui/components/NativeButton';
import { SelectField } from '@ui/components/SelectField';
import { defaultTheme } from '@ui/theme';

import { RequestFormScreen } from '../RequestFormScreen';
import { createRequestStyles } from '../styles';

jest.mock('@fresnica/ui-native', () => ({ Button: () => null }));

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
  options?: readonly { value: string; label: string; description?: string; accessibilityLabel?: string }[];
  onValueChange?: (value: string) => void;
  size?: string;
  variant?: string;
  style?: unknown;
  scrollable?: boolean;
  contentInset?: string;
  keyboardShouldPersistTaps?: string;
  showsVerticalScrollIndicator?: boolean;
}>;

function visit(node: React.ReactNode, callback: (element: React.ReactElement<NodeProps>) => void): void {
  if (!React.isValidElement<NodeProps>(node)) return;
  callback(node);
  React.Children.forEach(node.props.children, child => visit(child, callback));
}

function selectField(root: React.ReactNode, label: string) {
  let found: React.ReactElement<NodeProps> | undefined;
  visit(root, node => { if (node.type === SelectField && node.props.label === label) found = node; });
  return found;
}

function renderForm(overrides: Partial<React.ComponentProps<typeof RequestFormScreen>> = {}) {
  const onCopy = jest.fn();
  const onShare = jest.fn();
  const onToggleQr = jest.fn();
  const onPasteRequest = jest.fn();
  const onScanRequest = jest.fn();
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
    onPasteRequest,
    onScanRequest,
    onCancel: jest.fn(),
    ...overrides,
  });
  return { root, onCopy, onShare, onToggleQr, onPasteRequest, onScanRequest, canonicalUri };
}

describe('RequestFormScreen', () => {
  it('keeps the localized Back callback available during idle/busy and preserves the Request title', () => {
    const styles = createRequestStyles(defaultTheme);

    for (const busy of [false, true]) {
      const onCancel = jest.fn();
      const { root } = renderForm({ busy, onCancel });
      expect(root.type).toBe(Screen);
      expect(root.props).toMatchObject({ scrollable: false, contentInset: 'none' });

      const header = React.Children.toArray(root.props.children).find(
        (child): child is React.ReactElement<NodeProps> =>
          React.isValidElement<NodeProps>(child) && child.type === View,
      );
      expect(header?.props.style).toEqual(styles.header);

      const parts = React.Children.toArray(header?.props.children).filter(
        (child): child is React.ReactElement<NodeProps> => React.isValidElement<NodeProps>(child),
      );
      expect(parts).toHaveLength(2);
      const [left, title] = parts;
      expect(left?.type).toBe(View);
      expect(title?.type).toBe(Text);
      expect(title?.props.children).toBe('request.title');
      expect(left?.props.style).toEqual(styles.headerSide);
      expect(styles.header).not.toHaveProperty('justifyContent', 'space-between');
      expect(styles.header.minHeight).toBe(58);

      const backControls = React.Children.toArray(left?.props.children).filter(
        (child): child is React.ReactElement<NodeProps> =>
          React.isValidElement<NodeProps>(child) && child.type === NativeButton,
      );
      expect(backControls).toHaveLength(1);
      expect(backControls[0]?.props).toMatchObject({
        label: 'request.back',
        onPress: onCancel,
        size: 'sm',
        variant: 'quiet',
      });
      expect(backControls[0]?.props.disabled).toBeUndefined();
      backControls[0]?.props.onPress?.();
      expect(onCancel).toHaveBeenCalledTimes(1);

      const scrollers: React.ReactElement<NodeProps>[] = [];
      visit(root, element => {
        if (element.type === ScrollView) scrollers.push(element);
      });
      expect(scrollers[0]?.props).toMatchObject({
        keyboardShouldPersistTaps: 'handled',
        showsVerticalScrollIndicator: false,
      });
    }
  });

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

  it('selects the exact issuer when two request assets share a code', () => {
    const issuerA = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const issuerB = 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
    const assetA = { kind: 'credit' as const, code: 'USD', issuer: issuerA };
    const assetB = { kind: 'credit' as const, code: 'USD', issuer: issuerB };
    const onSelectAsset = jest.fn();
    const { root } = renderForm({
      assets: [{ kind: 'native' }, assetA, assetB],
      selectedAsset: assetA,
      onSelectAsset,
    });
    const picker = selectField(root, 'request.asset');
    const issuedOptions = picker?.props.options?.filter(option => option.label === 'USD');
    expect(issuedOptions?.map(option => option.description)).toEqual([issuerA, issuerB]);
    expect(issuedOptions?.map(option => option.accessibilityLabel)).toEqual([
      `issued:USD:${issuerA}`, `issued:USD:${issuerB}`,
    ]);
    expect(picker?.props.value).toBe(issuedOptions?.[0].value);
    picker?.props.onValueChange?.(issuedOptions![1].value);
    expect(onSelectAsset).toHaveBeenCalledWith(assetB);
    picker?.props.onValueChange?.('missing-asset');
    expect(onSelectAsset).toHaveBeenCalledTimes(1);
  });

  it('offers Return memo separately and preserves a value on same-type selection', () => {
    const onSelectMemoType = jest.fn();
    const { root } = renderForm({ onSelectMemoType });
    const picker = selectField(root, 'request.memo');
    expect(picker?.props.options?.map(option => option.value)).toEqual(['none', 'text', 'id', 'hash', 'return']);
    picker?.props.onValueChange?.('id');
    expect(onSelectMemoType).not.toHaveBeenCalled();
    picker?.props.onValueChange?.('return');
    expect(onSelectMemoType).toHaveBeenCalledWith('return');
  });

  it('keeps request asset and memo selection disabled while busy', () => {
    const onSelectAsset = jest.fn(), onSelectMemoType = jest.fn();
    const { root } = renderForm({ busy: true, onSelectAsset, onSelectMemoType });
    const assets = selectField(root, 'request.asset');
    const memo = selectField(root, 'request.memo');
    expect(assets?.props.disabled).toBe(true);
    expect(memo?.props.disabled).toBe(true);
    assets?.props.onValueChange?.(assets.props.options![1].value);
    memo?.props.onValueChange?.('return');
    expect(onSelectAsset).not.toHaveBeenCalled();
    expect(onSelectMemoType).not.toHaveBeenCalled();
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

  it('keeps paste and scan as explicit user actions', () => {
    const { root, onPasteRequest, onScanRequest } = renderForm();
    const actions = new Map<string, React.ReactElement<NodeProps>>();
    visit(root, element => {
      if (['request.ingress.paste', 'request.ingress.scan'].includes(element.props.label ?? '')) {
        actions.set(element.props.label ?? '', element);
      }
    });

    expect(onPasteRequest).not.toHaveBeenCalled();
    expect(onScanRequest).not.toHaveBeenCalled();
    actions.get('request.ingress.paste')?.props.onPress?.();
    actions.get('request.ingress.scan')?.props.onPress?.();
    expect(onPasteRequest).toHaveBeenCalledTimes(1);
    expect(onScanRequest).toHaveBeenCalledTimes(1);
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
