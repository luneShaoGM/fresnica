import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Screen } from '@ui/components';
import { NativeButton } from '@ui/components/NativeButton';
import { defaultTheme } from '@ui/theme';

import type { RequestPaymentIntent } from '../../../capabilities/request/requestUri';
import { RequestDeepLinkScreen, type RequestDeepLinkViewState } from '../RequestDeepLinkScreen';
import { createRequestIngressStyles } from '../ingressStyles';

jest.mock('@fresnica/ui-native', () => ({ Button: () => null }));
jest.mock('react-native-qrcode-svg', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../../ui/theme', () => {
  const actual = jest.requireActual('../../../ui/theme') as typeof import('../../../ui/theme');
  return {
    ...actual,
    useThemedStyles: (factory: (theme: typeof actual.defaultTheme) => unknown) => factory(actual.defaultTheme),
  };
});
jest.mock('../../../locale', () => ({ useLocalization: () => ({ t: (key: string) => key }) }));

type NodeProps = Readonly<{
  children?: React.ReactNode;
  label?: string;
  onPress?: () => void;
  onClose?: () => void;
  onContinue?: () => void;
  size?: string;
  variant?: string;
  disabled?: boolean;
  style?: unknown;
  scrollable?: boolean;
  contentInset?: string;
  showsVerticalScrollIndicator?: boolean;
  state?: RequestDeepLinkViewState;
  intent?: RequestPaymentIntent;
  reason?: string;
}>;

const intent: RequestPaymentIntent = {
  syntax: 'sep7-pay',
  destination: `G${'A'.repeat(55)}`,
  asset: { kind: 'native' },
  amount: '1',
  networkId: 'stellar-testnet',
  networkPassphrase: 'Test SDF Network ; September 2015',
};

describe('RequestDeepLinkScreen Native Close', () => {
  it.each([
    { state: { kind: 'ready' as const, intent, accountId: 'current-testnet-account' } },
    { state: { kind: 'blocked' as const, reason: 'network-mismatch' as const } },
  ])('keeps localized Close on the original onClose and balances the %p header', ({ state }) => {
    const onClose = jest.fn();
    const onContinue = jest.fn();
    const styles = createRequestIngressStyles(defaultTheme);
    const root = RequestDeepLinkScreen({ state, onClose, onContinue });
    expect(root.type).toBe(Screen);
    expect(root.props).toMatchObject({ scrollable: false, contentInset: 'none' });

    const [header, scroller] = React.Children.toArray(root.props.children).filter(
      (child): child is React.ReactElement<NodeProps> => React.isValidElement<NodeProps>(child),
    );
    expect(header?.type).toBe(View);
    expect(header?.props.style).toEqual(styles.deepLinkHeader);
    expect(scroller?.type).toBe(ScrollView);
    expect(scroller?.props.showsVerticalScrollIndicator).toBe(false);

    const [left, title, right] = React.Children.toArray(header?.props.children).filter(
      (child): child is React.ReactElement<NodeProps> => React.isValidElement<NodeProps>(child),
    );
    expect(left?.type).toBe(View);
    expect(title?.type).toBe(Text);
    expect(title?.props.children).toBe('request.deepLink.title');
    expect(right?.type).toBe(View);
    expect(left?.props.style).toEqual(styles.deepLinkHeaderSide);
    expect(right?.props.style).toEqual(styles.deepLinkHeaderSide);
    expect(styles.deepLinkHeaderSide).toMatchObject({ flex: 1, alignItems: 'flex-start' });
    expect(styles.deepLinkHeader).not.toHaveProperty('justifyContent', 'space-between');
    expect(styles.deepLinkHeader.minHeight).toBe(58);

    const close = React.Children.toArray(left?.props.children).filter(
      (child): child is React.ReactElement<NodeProps> =>
        React.isValidElement<NodeProps>(child) && child.type === NativeButton,
    );
    expect(close).toHaveLength(1);
    expect(close[0]?.props).toMatchObject({
      label: 'request.deepLink.close',
      size: 'sm',
      variant: 'quiet',
      onPress: onClose,
    });
    expect(close[0]?.props.disabled).toBeUndefined();
    expect(
      React.Children.toArray(header?.props.children).some(
        child => React.isValidElement(child) && child.type === Pressable,
      ),
    ).toBe(false);

    close[0]?.props.onPress?.();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onContinue).not.toHaveBeenCalled();

    const [content] = React.Children.toArray(scroller?.props.children).filter(
      (child): child is React.ReactElement<NodeProps> => React.isValidElement<NodeProps>(child),
    );
    if (state.kind === 'ready') {
      expect(content?.props).toMatchObject({ intent, onContinue });
    } else {
      expect(content?.props).toMatchObject({ reason: 'network-mismatch' });
      expect(content?.props.onContinue).toBeUndefined();
    }

    // UI-05c migrates Ingress independently; both screens now use the same symmetric header tokens.
    expect(styles.header).toEqual(styles.deepLinkHeader);
    expect(styles.headerSide).toEqual(styles.deepLinkHeaderSide);
  });
});
